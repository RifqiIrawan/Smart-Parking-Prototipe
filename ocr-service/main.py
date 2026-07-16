"""
Smart Parking OCR Service
Uses PaddleOCR + OpenCV for license plate detection and recognition.
"""

import os
import base64
import io
import re
import logging
from typing import Optional, Tuple

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# np.sctypes was removed in NumPy 2.0; imgaug (a PaddleOCR dependency) still uses it.
if not hasattr(np, "sctypes"):
    np.sctypes = {
        "float": [np.float16, np.float32, np.float64],
        "int": [np.int8, np.int16, np.int32, np.int64],
        "uint": [np.uint8, np.uint16, np.uint32, np.uint64],
        "complex": [np.complex64, np.complex128],
        "others": [bool, object, bytes, str, np.void],
    }

# PaddleOCR - import lazily for startup speed
try:
    from paddleocr import PaddleOCR
    PADDLE_AVAILABLE = True
except ImportError:
    PADDLE_AVAILABLE = False
    logging.warning("PaddleOCR not installed. Using mock OCR mode.")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Smart Parking OCR Service",
    description="License plate detection and recognition API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OCR engine
ocr_engine = None
if PADDLE_AVAILABLE:
    try:
        ocr_engine = PaddleOCR(
            use_angle_cls=True,
            lang='en',
            use_gpu=False,
            show_log=False
        )
        logger.info("PaddleOCR initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize PaddleOCR: {e}")


class OCRRequest(BaseModel):
    image_base64: str
    enhance: bool = True
    debug: bool = False


class OCRResult(BaseModel):
    success: bool
    plate_number: Optional[str] = None
    confidence: float = 0.0
    raw_text: list = []
    processing_time_ms: int = 0
    error: Optional[str] = None


class PlateDetector:
    """License plate detection and preprocessing using OpenCV"""

    INDONESIAN_PLATE_PATTERN = re.compile(
        r'^[A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{1,3}$',
        re.IGNORECASE
    )

    @staticmethod
    def base64_to_image(b64_str: str) -> np.ndarray:
        """Convert base64 string to OpenCV image"""
        # Remove data URL prefix if present
        if ',' in b64_str:
            b64_str = b64_str.split(',')[1]
        img_bytes = base64.b64decode(b64_str)
        img_array = np.frombuffer(img_bytes, np.uint8)
        return cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    @staticmethod
    def image_to_base64(img: np.ndarray) -> str:
        """Convert OpenCV image to base64 string"""
        _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 90])
        return base64.b64encode(buffer).decode('utf-8')

    @staticmethod
    def enhance_image(img: np.ndarray) -> np.ndarray:
        """Enhance image for better OCR accuracy"""
        # Resize if too small
        h, w = img.shape[:2]
        if h < 200 or w < 400:
            scale = max(200 / h, 400 / w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)),
                           interpolation=cv2.INTER_CUBIC)

        # Convert to grayscale for processing
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Apply CLAHE for contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # Denoise
        denoised = cv2.fastNlMeansDenoising(enhanced, h=10)

        # Sharpen
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
        sharpened = cv2.filter2D(denoised, -1, kernel)

        # Convert back to BGR for PaddleOCR
        result = cv2.cvtColor(sharpened, cv2.COLOR_GRAY2BGR)
        return result

    @staticmethod
    def detect_plate_region(img: np.ndarray) -> Optional[np.ndarray]:
        """Detect and crop license plate region from image"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 50, 150)
        contours, _ = cv2.findContours(
            edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
        )
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]

        for contour in contours:
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(approx)
                aspect_ratio = w / h
                area = cv2.contourArea(contour)
                if (2.5 <= aspect_ratio <= 5.5 and
                        area > 1000 and
                        h > 20):
                    plate = img[y:y+h, x:x+w]
                    return plate

        return None

    @staticmethod
    def clean_plate_text(text: str) -> str:
        """Clean and normalize detected text to Indonesian plate format"""
        # Remove spaces and special characters
        cleaned = re.sub(r'[^A-Z0-9]', '', text.upper())

        # Common OCR mistakes for plates
        replacements = {
            'O': '0', 'I': '1', 'L': '1', 'S': '5', 'G': '6', 'B': '8'
        }

        # Try to match Indonesian plate pattern: 1-2 letters + 1-4 numbers + 1-3 letters
        match = re.match(r'^([A-Z]{1,2})(\d{1,4})([A-Z]{1,3})$', cleaned)
        if match:
            prefix, numbers, suffix = match.groups()
            return f"{prefix} {numbers} {suffix}"

        return cleaned

    @staticmethod
    def validate_indonesian_plate(text: str) -> Tuple[bool, float]:
        """Validate if text matches Indonesian plate format"""
        cleaned = text.upper().replace(' ', '')
        match = re.match(r'^([A-Z]{1,2})(\d{1,4})([A-Z]{1,3})$', cleaned)
        if match:
            return True, 0.95
        # Partial match
        if re.match(r'^[A-Z]{1,2}\d+', cleaned):
            return True, 0.6
        return False, 0.0


detector = PlateDetector()


def run_paddle_ocr(img: np.ndarray) -> list:
    """Run PaddleOCR on image and return results"""
    if not ocr_engine:
        return []
    try:
        result = ocr_engine.ocr(img, cls=True)
        texts = []
        if result and result[0]:
            for line in result[0]:
                if line and len(line) >= 2:
                    text = line[1][0]
                    confidence = float(line[1][1])
                    texts.append({"text": text, "confidence": confidence})
        return texts
    except Exception as e:
        logger.error(f"OCR error: {e}")
        return []


def mock_ocr_result() -> OCRResult:
    """Return mock result when OCR is not available"""
    import random
    import string
    prefix = random.choice(['B', 'D', 'F', 'L', 'BE', 'BK'])
    numbers = random.randint(1000, 9999)
    suffix = ''.join(random.choices(string.ascii_uppercase, k=3))
    plate = f"{prefix} {numbers} {suffix}"
    return OCRResult(
        success=True,
        plate_number=plate,
        confidence=0.87,
        raw_text=[{"text": plate, "confidence": 0.87}],
        processing_time_ms=42,
    )


@app.get("/")
def root():
    return {
        "service": "Smart Parking OCR",
        "version": "1.0.0",
        "ocr_available": PADDLE_AVAILABLE and ocr_engine is not None,
        "mode": "paddle" if (PADDLE_AVAILABLE and ocr_engine) else "mock"
    }


@app.get("/health")
def health():
    return {"status": "ok", "ocr_ready": ocr_engine is not None}


@app.post("/ocr/plate", response_model=OCRResult)
def detect_plate(request: OCRRequest):
    """
    Detect and recognize license plate from base64 image.
    
    - **image_base64**: Base64 encoded image (JPEG/PNG)
    - **enhance**: Apply image enhancement before OCR
    - **debug**: Include intermediate processing info
    """
    import time
    start = time.time()

    if not request.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    # Mock mode when PaddleOCR not available
    if not ocr_engine:
        logger.info("Using mock OCR mode")
        result = mock_ocr_result()
        return result

    try:
        # Decode image
        img = detector.base64_to_image(request.image_base64)
        if img is None:
            return OCRResult(success=False, error="Invalid image data")

        # Try to detect plate region
        plate_region = detector.detect_plate_region(img)
        target_img = plate_region if plate_region is not None else img

        # Enhance if requested
        if request.enhance:
            target_img = detector.enhance_image(target_img)

        # Run OCR
        texts = run_paddle_ocr(target_img)

        if not texts:
            # Try on full image if region detection failed
            if plate_region is not None:
                texts = run_paddle_ocr(img)

        if not texts:
            return OCRResult(
                success=False,
                error="No text detected in image",
                processing_time_ms=int((time.time() - start) * 1000)
            )

        # Find best plate candidate
        best_plate = None
        best_conf = 0.0
        all_texts = []

        for item in texts:
            text = item["text"]
            conf = item["confidence"]
            cleaned = detector.clean_plate_text(text)
            is_valid, plate_conf = detector.validate_indonesian_plate(cleaned)
            all_texts.append({"text": text, "cleaned": cleaned, "confidence": conf})

            if is_valid and (conf * plate_conf) > best_conf:
                best_plate = cleaned
                best_conf = conf * plate_conf

        elapsed = int((time.time() - start) * 1000)
        logger.info(f"OCR completed in {elapsed}ms. Plate: {best_plate} (conf: {best_conf:.2f})")

        return OCRResult(
            success=best_plate is not None,
            plate_number=best_plate,
            confidence=round(best_conf, 3),
            raw_text=all_texts if request.debug else [],
            processing_time_ms=elapsed,
            error=None if best_plate else "Could not identify valid plate number"
        )

    except Exception as e:
        logger.exception("OCR processing error")
        return OCRResult(
            success=False,
            error=str(e),
            processing_time_ms=int((time.time() - start) * 1000)
        )


@app.post("/ocr/test")
def test_ocr():
    """Test endpoint that generates a sample image and runs OCR"""
    if not ocr_engine:
        return mock_ocr_result()

    # Create test image with plate text
    img = np.ones((100, 300, 3), dtype=np.uint8) * 240
    cv2.rectangle(img, (0, 0), (299, 99), (0, 0, 200), 3)
    cv2.putText(img, "B 1234 ABC", (30, 65), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 3)
    b64 = detector.image_to_base64(img)
    return detect_plate(OCRRequest(image_base64=b64, enhance=False, debug=True))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
