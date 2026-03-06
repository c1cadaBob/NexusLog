package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"io"
	"sync"
	"time"
)

const (
	aesKeyLen = 32
	gcmNonceLen = 12
)

var (
	ErrInvalidKeyLength = errors.New("key must be exactly 32 bytes for AES-256")
)

// Envelope is the encrypted payload structure sent over the wire.
type Envelope struct {
	KeyID     string `json:"key_id"`     // Which key was used
	Nonce     []byte `json:"nonce"`      // GCM nonce (12 bytes)
	Ciphertext []byte `json:"ciphertext"` // AES-256-GCM encrypted data
	HMAC      []byte `json:"hmac"`       // HMAC-SHA256 of ciphertext
	Timestamp int64  `json:"timestamp"`  // Unix seconds, for replay prevention
}

// KeyPair holds the active and optional next key for rotation.
type KeyPair struct {
	ActiveKeyID string
	ActiveKey   []byte // 32 bytes for AES-256
	NextKeyID   string // empty if no rotation in progress
	NextKey     []byte // 32 bytes for AES-256, nil if no rotation
}

// Encryptor encrypts payloads using the active key.
type Encryptor struct {
	mu   sync.RWMutex
	keys KeyPair
}

// NewEncryptor creates an encryptor and validates key length.
func NewEncryptor(keys KeyPair) (*Encryptor, error) {
	if len(keys.ActiveKey) != aesKeyLen {
		return nil, ErrInvalidKeyLength
	}
	if keys.NextKey != nil && len(keys.NextKey) != aesKeyLen {
		return nil, ErrInvalidKeyLength
	}
	return &Encryptor{keys: keys}, nil
}

// Encrypt encrypts plaintext with AES-256-GCM and HMAC-SHA256.
func (e *Encryptor) Encrypt(plaintext []byte) (*Envelope, error) {
	e.mu.RLock()
	keyID := e.keys.ActiveKeyID
	key := e.keys.ActiveKey
	e.mu.RUnlock()

	return e.encryptWithKey(plaintext, keyID, key)
}

// encryptWithKey performs encryption using the given key.
func (e *Encryptor) encryptWithKey(plaintext []byte, keyID string, key []byte) (*Envelope, error) {
	if len(key) != aesKeyLen {
		return nil, ErrInvalidKeyLength
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcmNonceLen)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)
	timestamp := time.Now().Unix()

	hmacInput := e.buildHMACInput(nonce, ciphertext, timestamp)
	mac := hmac.New(sha256.New, key)
	mac.Write(hmacInput)
	hmacSum := mac.Sum(nil)

	return &Envelope{
		KeyID:      keyID,
		Nonce:      nonce,
		Ciphertext: ciphertext,
		HMAC:       hmacSum,
		Timestamp:  timestamp,
	}, nil
}

// buildHMACInput concatenates nonce + ciphertext + timestamp (8 bytes big-endian).
func (e *Encryptor) buildHMACInput(nonce, ciphertext []byte, ts int64) []byte {
	tsBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(tsBytes, uint64(ts))
	var b []byte
	b = append(b, nonce...)
	b = append(b, ciphertext...)
	b = append(b, tsBytes...)
	return b
}

// UpdateKeys hot-swaps keys without restart.
func (e *Encryptor) UpdateKeys(keys KeyPair) error {
	if len(keys.ActiveKey) != aesKeyLen {
		return ErrInvalidKeyLength
	}
	if keys.NextKey != nil && len(keys.NextKey) != aesKeyLen {
		return ErrInvalidKeyLength
	}
	e.mu.Lock()
	e.keys = keys
	e.mu.Unlock()
	return nil
}
