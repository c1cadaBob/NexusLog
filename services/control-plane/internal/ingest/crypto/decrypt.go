package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math"
	"sync"
	"time"
)

const (
	aesKeyLen       = 32
	replayWindowSec = 5 * 60 // 5 minutes
)

const (
	ErrorCodeDecryptFailed  = "INGEST_DECRYPT_FAILED"
	ErrorCodeReplayRejected = "INGEST_REPLAY_REJECTED"
)

// Envelope is the encrypted payload structure received from the agent.
type Envelope struct {
	KeyID      string `json:"key_id"`
	Nonce      []byte `json:"nonce"`
	Ciphertext []byte `json:"ciphertext"`
	HMAC       []byte `json:"hmac"`
	Timestamp  int64  `json:"timestamp"`
}

// DecryptError represents a decryption failure with an error code.
type DecryptError struct {
	Code    string
	Message string
}

func (e *DecryptError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// KeyPair holds active and optional next key for rotation window.
type KeyPair struct {
	ActiveKeyID string
	ActiveKey   []byte // 32 bytes
	NextKeyID   string
	NextKey     []byte // 32 bytes, nil if no rotation
}

// Decryptor decrypts envelopes using active/next keys.
type Decryptor struct {
	mu   sync.RWMutex
	keys KeyPair
}

// NewDecryptor creates a decryptor, validating key lengths.
func NewDecryptor(keys KeyPair) (*Decryptor, error) {
	if err := validateKeyPair(keys); err != nil {
		return nil, err
	}
	return &Decryptor{keys: keys}, nil
}

// Decrypt decrypts an envelope: replay check → key lookup → HMAC verify → AES-GCM decrypt.
func (d *Decryptor) Decrypt(env *Envelope) ([]byte, error) {
	if env == nil {
		return nil, &DecryptError{Code: ErrorCodeDecryptFailed, Message: "nil envelope"}
	}

	elapsed := math.Abs(float64(time.Now().Unix() - env.Timestamp))
	if elapsed > float64(replayWindowSec) {
		return nil, &DecryptError{
			Code:    ErrorCodeReplayRejected,
			Message: fmt.Sprintf("timestamp %d is outside the 5-minute replay window", env.Timestamp),
		}
	}

	d.mu.RLock()
	keys := d.keys
	d.mu.RUnlock()

	key := d.resolveKey(keys, env.KeyID)
	if key == nil {
		return nil, &DecryptError{
			Code:    ErrorCodeDecryptFailed,
			Message: fmt.Sprintf("no matching key for key_id %q", env.KeyID),
		}
	}

	hmacInput := buildHMACInput(env.Nonce, env.Ciphertext, env.Timestamp)
	mac := hmac.New(sha256.New, key)
	mac.Write(hmacInput)
	expectedMAC := mac.Sum(nil)
	if !hmac.Equal(env.HMAC, expectedMAC) {
		return nil, &DecryptError{
			Code:    ErrorCodeDecryptFailed,
			Message: "HMAC verification failed",
		}
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, &DecryptError{Code: ErrorCodeDecryptFailed, Message: err.Error()}
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, &DecryptError{Code: ErrorCodeDecryptFailed, Message: err.Error()}
	}

	plaintext, err := gcm.Open(nil, env.Nonce, env.Ciphertext, nil)
	if err != nil {
		return nil, &DecryptError{Code: ErrorCodeDecryptFailed, Message: "GCM decryption failed"}
	}

	return plaintext, nil
}

// UpdateKeys replaces keys under lock for hot rotation.
func (d *Decryptor) UpdateKeys(keys KeyPair) error {
	if err := validateKeyPair(keys); err != nil {
		return err
	}
	d.mu.Lock()
	d.keys = keys
	d.mu.Unlock()
	return nil
}

func (d *Decryptor) resolveKey(keys KeyPair, keyID string) []byte {
	if keyID == keys.ActiveKeyID && len(keys.ActiveKey) == aesKeyLen {
		return keys.ActiveKey
	}
	if keyID == keys.NextKeyID && len(keys.NextKey) == aesKeyLen {
		return keys.NextKey
	}
	return nil
}

func buildHMACInput(nonce, ciphertext []byte, ts int64) []byte {
	tsBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(tsBytes, uint64(ts))
	buf := make([]byte, 0, len(nonce)+len(ciphertext)+8)
	buf = append(buf, nonce...)
	buf = append(buf, ciphertext...)
	buf = append(buf, tsBytes...)
	return buf
}

func validateKeyPair(keys KeyPair) error {
	if len(keys.ActiveKey) != aesKeyLen {
		return fmt.Errorf("active key must be exactly %d bytes", aesKeyLen)
	}
	if keys.NextKey != nil && len(keys.NextKey) != aesKeyLen {
		return fmt.Errorf("next key must be exactly %d bytes", aesKeyLen)
	}
	return nil
}
