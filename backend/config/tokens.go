package config

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
)

// GenerateOpaqueToken returns a random URL-safe token used for refresh
// tokens and password-reset links. Only its hash is ever stored server-side.
func GenerateOpaqueToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// HashToken returns the sha256 hex digest of a token, for DB storage/lookup.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
