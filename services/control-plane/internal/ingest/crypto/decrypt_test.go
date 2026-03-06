package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	chmac "crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"io"
	"testing"
	"time"
)

func genKey(t *testing.T) []byte {
	t.Helper()
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	return key
}

func encryptForTest(t *testing.T, plaintext []byte, keyID string, key []byte) *Envelope {
	t.Helper()
	block, err := aes.NewCipher(key)
	if err != nil {
		t.Fatal(err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatal(err)
	}
	nonce := make([]byte, 12)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		t.Fatal(err)
	}
	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)
	ts := time.Now().Unix()

	tsBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(tsBytes, uint64(ts))

	mac := chmac.New(sha256.New, key)
	mac.Write(nonce)
	mac.Write(ciphertext)
	mac.Write(tsBytes)

	return &Envelope{
		KeyID:      keyID,
		Nonce:      nonce,
		Ciphertext: ciphertext,
		HMAC:       mac.Sum(nil),
		Timestamp:  ts,
	}
}

func TestDecryptSuccess(t *testing.T) {
	key := genKey(t)
	dec, err := NewDecryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key})
	if err != nil {
		t.Fatal(err)
	}

	original := []byte("2024-01-01 [ERROR] database timeout")
	env := encryptForTest(t, original, "k1", key)

	plaintext, err := dec.Decrypt(env)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if string(plaintext) != string(original) {
		t.Errorf("plaintext = %q, want %q", plaintext, original)
	}
}

func TestDecryptWithNextKey(t *testing.T) {
	activeKey := genKey(t)
	nextKey := genKey(t)
	dec, err := NewDecryptor(KeyPair{
		ActiveKeyID: "k1", ActiveKey: activeKey,
		NextKeyID: "k2", NextKey: nextKey,
	})
	if err != nil {
		t.Fatal(err)
	}

	env := encryptForTest(t, []byte("test data"), "k2", nextKey)
	plaintext, err := dec.Decrypt(env)
	if err != nil {
		t.Fatalf("Decrypt with next key: %v", err)
	}
	if string(plaintext) != "test data" {
		t.Errorf("plaintext = %q, want 'test data'", plaintext)
	}
}

func TestDecryptKeyMismatch(t *testing.T) {
	key1 := genKey(t)
	key2 := genKey(t)
	dec, _ := NewDecryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key1})

	env := encryptForTest(t, []byte("secret"), "k2", key2)
	_, err := dec.Decrypt(env)
	if err == nil {
		t.Fatal("expected error for key mismatch")
	}
	de, ok := err.(*DecryptError)
	if !ok {
		t.Fatalf("expected DecryptError, got %T", err)
	}
	if de.Code != ErrorCodeDecryptFailed {
		t.Errorf("error code = %q, want %q", de.Code, ErrorCodeDecryptFailed)
	}
}

func TestDecryptReplayRejected(t *testing.T) {
	key := genKey(t)
	dec, _ := NewDecryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key})

	env := encryptForTest(t, []byte("old data"), "k1", key)
	env.Timestamp = time.Now().Unix() - 400 // 6+ minutes ago

	// Need to recompute HMAC with new timestamp
	tsBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(tsBytes, uint64(env.Timestamp))
	mac := chmac.New(sha256.New, key)
	mac.Write(env.Nonce)
	mac.Write(env.Ciphertext)
	mac.Write(tsBytes)
	env.HMAC = mac.Sum(nil)

	_, err := dec.Decrypt(env)
	if err == nil {
		t.Fatal("expected error for replay attack")
	}
	de, ok := err.(*DecryptError)
	if !ok {
		t.Fatalf("expected DecryptError, got %T", err)
	}
	if de.Code != ErrorCodeReplayRejected {
		t.Errorf("error code = %q, want %q", de.Code, ErrorCodeReplayRejected)
	}
}

func TestDecryptTamperedHMAC(t *testing.T) {
	key := genKey(t)
	dec, _ := NewDecryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key})

	env := encryptForTest(t, []byte("data"), "k1", key)
	env.HMAC[0] ^= 0xFF // tamper

	_, err := dec.Decrypt(env)
	if err == nil {
		t.Fatal("expected error for tampered HMAC")
	}
	de, ok := err.(*DecryptError)
	if !ok {
		t.Fatalf("expected DecryptError, got %T", err)
	}
	if de.Code != ErrorCodeDecryptFailed {
		t.Errorf("code = %q, want %q", de.Code, ErrorCodeDecryptFailed)
	}
}

func TestDecryptNilEnvelope(t *testing.T) {
	key := genKey(t)
	dec, _ := NewDecryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key})

	_, err := dec.Decrypt(nil)
	if err == nil {
		t.Fatal("expected error for nil envelope")
	}
}

func TestDecryptorUpdateKeys(t *testing.T) {
	key1 := genKey(t)
	key2 := genKey(t)
	dec, _ := NewDecryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key1})

	err := dec.UpdateKeys(KeyPair{ActiveKeyID: "k2", ActiveKey: key2})
	if err != nil {
		t.Fatal(err)
	}

	env := encryptForTest(t, []byte("test"), "k2", key2)
	plaintext, err := dec.Decrypt(env)
	if err != nil {
		t.Fatalf("Decrypt after key update: %v", err)
	}
	if string(plaintext) != "test" {
		t.Errorf("plaintext = %q, want 'test'", plaintext)
	}
}

func TestNewDecryptor_InvalidKey(t *testing.T) {
	_, err := NewDecryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: []byte("short")})
	if err == nil {
		t.Fatal("expected error for invalid key length")
	}
}
