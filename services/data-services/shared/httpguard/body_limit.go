package httpguard

import (
	"errors"
	"fmt"
	"io"
)

const DefaultMaxResponseBodyBytes int64 = 16 << 20

var ErrResponseBodyTooLarge = errors.New("response body exceeds size limit")

func ReadLimitedBody(reader io.Reader, limit int64) ([]byte, error) {
	if reader == nil {
		return nil, nil
	}
	if limit <= 0 {
		limit = DefaultMaxResponseBodyBytes
	}
	body, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > limit {
		return nil, fmt.Errorf("%w: max=%d", ErrResponseBodyTooLarge, limit)
	}
	return body, nil
}
