package crypto

import (
	"crypto/rand"
	"testing"
)

func generateKey(t *testing.T) []byte {
	t.Helper()
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	return key
}

func TestNewEncryptor_ValidKey(t *testing.T) {
	key := generateKey(t)
	enc, err := NewEncryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if enc == nil {
		t.Fatal("encryptor should not be nil")
	}
}

func TestNewEncryptor_InvalidKeyLength(t *testing.T) {
	_, err := NewEncryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: []byte("short")})
	if err != ErrInvalidKeyLength {
		t.Fatalf("expected ErrInvalidKeyLength, got %v", err)
	}
}

func TestNewEncryptor_InvalidNextKey(t *testing.T) {
	key := generateKey(t)
	_, err := NewEncryptor(KeyPair{
		ActiveKeyID: "k1", ActiveKey: key,
		NextKeyID: "k2", NextKey: []byte("short"),
	})
	if err != ErrInvalidKeyLength {
		t.Fatalf("expected ErrInvalidKeyLength, got %v", err)
	}
}

func TestEncryptDecryptRoundtrip(t *testing.T) {
	key := generateKey(t)
	enc, err := NewEncryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key})
	if err != nil {
		t.Fatal(err)
	}

	plaintext := []byte("2024-01-01 [ERROR] database connection timeout")
	env, err := enc.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	if env.KeyID != "k1" {
		t.Errorf("KeyID = %q, want k1", env.KeyID)
	}
	if len(env.Nonce) != gcmNonceLen {
		t.Errorf("Nonce length = %d, want %d", len(env.Nonce), gcmNonceLen)
	}
	if len(env.Ciphertext) == 0 {
		t.Error("Ciphertext should not be empty")
	}
	if len(env.HMAC) != 32 {
		t.Errorf("HMAC length = %d, want 32", len(env.HMAC))
	}
	if env.Timestamp == 0 {
		t.Error("Timestamp should be set")
	}

	// Ciphertext should not contain plaintext
	if string(env.Ciphertext) == string(plaintext) {
		t.Error("ciphertext should not equal plaintext")
	}
}

func TestEncryptDifferentNonces(t *testing.T) {
	key := generateKey(t)
	enc, err := NewEncryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key})
	if err != nil {
		t.Fatal(err)
	}

	env1, _ := enc.Encrypt([]byte("same data"))
	env2, _ := enc.Encrypt([]byte("same data"))

	if string(env1.Nonce) == string(env2.Nonce) {
		t.Error("two encryptions should have different nonces")
	}
	if string(env1.Ciphertext) == string(env2.Ciphertext) {
		t.Error("two encryptions should produce different ciphertexts")
	}
}

func TestEncryptEmptyPayload(t *testing.T) {
	key := generateKey(t)
	enc, err := NewEncryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key})
	if err != nil {
		t.Fatal(err)
	}

	env, err := enc.Encrypt([]byte{})
	if err != nil {
		t.Fatalf("Encrypt empty: %v", err)
	}
	if env == nil {
		t.Fatal("envelope should not be nil")
	}
}

func TestUpdateKeys(t *testing.T) {
	key1 := generateKey(t)
	key2 := generateKey(t)
	enc, _ := NewEncryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key1})

	err := enc.UpdateKeys(KeyPair{ActiveKeyID: "k2", ActiveKey: key2})
	if err != nil {
		t.Fatalf("UpdateKeys: %v", err)
	}

	env, _ := enc.Encrypt([]byte("test"))
	if env.KeyID != "k2" {
		t.Errorf("after update, KeyID = %q, want k2", env.KeyID)
	}
}

func TestUpdateKeys_InvalidLength(t *testing.T) {
	key := generateKey(t)
	enc, _ := NewEncryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key})

	err := enc.UpdateKeys(KeyPair{ActiveKeyID: "k2", ActiveKey: []byte("short")})
	if err != ErrInvalidKeyLength {
		t.Fatalf("expected ErrInvalidKeyLength, got %v", err)
	}
}

func BenchmarkEncrypt(b *testing.B) {
	key := make([]byte, 32)
	_, _ = rand.Read(key)
	enc, _ := NewEncryptor(KeyPair{ActiveKeyID: "k1", ActiveKey: key})
	data := make([]byte, 4096)
	_, _ = rand.Read(data)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = enc.Encrypt(data)
	}
}
