package ingest

import (
	"regexp"
	"strings"
)

// ErrorTypeDetector 增强的错误类型检测器
// 支持多种编程语言和框架的错误模式识别
type ErrorTypeDetector struct {
	// 语言/框架特定的错误模式
	patterns []errorPattern
}

// errorPattern 定义一种错误检测模式
type errorPattern struct {
	// 模式名称
	name string
	// 正则表达式
	regex *regexp.Regexp
	// 提取函数
	extractor func(matches []string) (errorType, errorMessage string)
	// 优先级（数字越小越高）
	priority int
}

// ErrorTypeCategory 错误类型分类
type ErrorTypeCategory string

const (
	// 语言运行时错误
	CategoryRuntime    ErrorTypeCategory = "runtime"
	CategorySyntax     ErrorTypeCategory = "syntax"
	CategoryNetwork    ErrorTypeCategory = "network"
	CategoryDatabase   ErrorTypeCategory = "database"
	CategorySecurity   ErrorTypeCategory = "security"
	CategoryTimeout    ErrorTypeCategory = "timeout"
	CategoryPermission ErrorTypeCategory = "permission"
	CategoryConfig     ErrorTypeCategory = "config"
	CategoryExternal   ErrorTypeCategory = "external"
	CategoryUnknown    ErrorTypeCategory = "unknown"
)

var (
	// 通用错误模式（兜底）
	genericErrorPatterns = []*regexp.Regexp{
		// ERROR/WARN/FATAL 关键词
		regexp.MustCompile(`(?i)^(error|fatal|panic|critical)\s*[:\-]?\s*(.*)$`),
		// Exception/Error 结尾
		regexp.MustCompile(`([A-Za-z0-9_]+(?:Exception|Error))\s*[:\-]?\s*(.*)$`),
		// "Caused by:" 包装
		regexp.MustCompile(`(?i)^caused by:\s*([a-zA-Z0-9_.]+(?:Exception|Error))\s*[:\-]?\s*(.*)$`),
	}

	// Java 错误模式
	javaPatterns = []*regexp.Regexp{
		// java.lang.RuntimeException
		regexp.MustCompile(`java\.lang\.(RuntimeException|NullPointerException|IllegalArgumentException|IllegalStateException|IndexOutOfBoundsException|ConcurrentModificationException|UnsupportedOperationException|ClassCastException|ArrayStoreException|ArithmeticException)`),
		// javax.servlet
		regexp.MustCompile(`javax\.servlet\.(ServletException|FilterChain|LifecycleException)`),
		// org.springframework
		regexp.MustCompile(`org\.springframework\.(beans|context|core|web|orm|jdbc|transaction|task|amqp|kafka|security|cache)`),
		// Hibernate
		regexp.MustCompile(`org\.hibernate\.(HibernateException|PersistenceException|QueryException|PropertyAccessException)`),
		// Tomcat/Jetty
		regexp.MustCompile(`(org\.apache\.tomcat|org\.eclipse\.jetty)\.[a-zA-Z.]+Exception`),
		// Jackson
		regexp.MustCompile(`com\.fasterxml\.jackson\.(core|databind|annotations)\.[a-zA-Z]+Exception`),
		// Kafka
		regexp.MustCompile(`org\.apache\.kafka\.[a-zA-Z.]+Exception`),
		// Dubbo
		regexp.MustCompile(`org\.apache\.dubbo\.[a-zA-Z.]+Exception`),
	}

	// Python 错误模式
	pythonPatterns = []*regexp.Regexp{
		// Built-in exceptions
		regexp.MustCompile(`(ZeroDivisionError|IndexError|KeyError|TypeError|ValueError|NameError|AttributeError|SyntaxError|IndentationError|OSError|IOError|RuntimeError|NotImplementedError|StopIteration|AssertionError|TabError|UnicodeDecodeError|UnicodeEncodeError|UnicodeError)`),
		// Django
		regexp.MustCompile(`django\.(core|db|http|views|urls|forms)\.[a-zA-Z]+Error`),
		// Flask
		regexp.MustCompile(`flask\.(exceptions|ctx)\.[a-zA-Z]+Error`),
		// Requests
		regexp.MustCompile(`requests\.(exceptions|models)\.[a-zA-Z]+Error`),
		// NumPy/Pandas
		regexp.MustCompile(`(numpy|pandas)\.[a-zA-Z.]+Exception`),
		// SQLAlchemy
		regexp.MustCompile(`sqlalchemy\.(exc|orm|engine)\.[a-zA-Z]+Error`),
	}

	// Node.js/JavaScript 错误模式
	nodePatterns = []*regexp.Regexp{
		// Node.js built-in errors
		regexp.MustCompile(`(Error|TypeError|ReferenceError|SyntaxError|RangeError|EvalError|URIError|JSON\.parse|AssertionError)`),
		// Express
		regexp.MustCompile(`express\.(Router|Application|Request|Response)\.[a-zA-Z]+Error`),
		// Mongoose
		regexp.MustCompile(`mongoose\.(Error|ValidationError|CastError|DuplicateKeyError)`),
		// Async/await
		regexp.MustCompile(`(UnhandledPromiseRejectionWarning|Promise\.reject)`),
		// npm error
		regexp.MustCompile(`npm\s+error\s+(code\s+)?(\w+)?`),
	}

	// Go 错误模式
	goPatterns = []*regexp.Regexp{
		// 标准库错误
		regexp.MustCompile(`(errors\.|fmt\.Errorf|fmt\.(Sprintf|Fprintf)|strconv\.(Atoi|ParseInt|ParseFloat)|json\.(Unmarshal|Marshal))`),
		// 常见第三方库
		regexp.MustCompile(`(github\.com|golang\.org|x/crypto|go\.uber\.org/zap|gorm\.io|labstack/echo)`),
		// Go 特有错误信息
		regexp.MustCompile(`(nil pointer|invalid memory address|index out of range|slice bounds out of range|concurrent map read and map write|send on closed channel)`),
	}

	// .NET/C# 错误模式
	dotnetPatterns = []*regexp.Regexp{
		// .NET 异常
		regexp.MustCompile(`(System\.(NullReferenceException|ArgumentNullException|ArgumentException|InvalidOperationException|NotSupportedException|TimeoutException|IOException|FormatException|DivideByZeroException|IndexOutOfRangeException|CastException))`),
		// ASP.NET Core
		regexp.MustCompile(`(Microsoft\.AspNetCore\.(Mvc|Http|Routing|Exceptions|Security|Authentication|Cors|Kestrel))`),
		// Entity Framework
		regexp.MustCompile(`(Microsoft\.EntityFrameworkCore\.[a-zA-Z.]+Exception)`),
	}

	// 数据库错误模式
	dbPatterns = []*regexp.Regexp{
		// PostgreSQL
		regexp.MustCompile(`(psql|postgres|postgresql)\s*[:\-]?\s*(error|exception)`),
		// MySQL
		regexp.MustCompile(`(mysql|mariadb)\s*[:\-]?\s*(error|exception)`),
		// MongoDB
		regexp.MustCompile(`(mongo|BSON|ObjectId)\s*[:\-]?\s*(error|exception)`),
		// Redis
		regexp.MustCompile(`(redis|REDIS)\s*[:\-]?\s*(error|exception|timeout)`),
		// ES
		regexp.MustCompile(`(elasticsearch|ES)\s*[:\-]?\s*(error|exception|timeout)`),
		// 通用 SQL
		regexp.MustCompile(`(SQL|sql|ODBC|JDBC)\s*(error|exception|timeout|fail)`),
		// 常见 DB 错误码
		regexp.MustCompile(`(ER_|MY_|PG_|ORA-|MongoError|NetworkTimeout)`),
	}

	// 网络错误模式
	networkPatterns = []*regexp.Regexp{
		// HTTP 错误码
		regexp.MustCompile(`(HTTP|https?)\s*(error|status|code)?\s*[:\-]?\s*(\d{3})`),
		// 连接错误
		regexp.MustCompile(`(connection\s*(refused|reset|timeout|closed|failed)|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_NONAME)`),
		// TLS/SSL 错误
		regexp.MustCompile(`(TLS|SSL|tls|ssl)\s*(error|handshake\s*fail|certificate|protocol)`),
		// DNS 错误
		regexp.MustCompile(`(DNS|dns|getaddrinfo|lookup\s+failed|nxdomain)`),
	}

	// 超时错误模式
	timeoutPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(timeout|timed?\s*out|ETIMEDOUT|Can't\s+assign\s+requested\s+address)`),
		// 数据库超时
		regexp.MustCompile(`(?i)(query|connection|read|write|exec|dml)\s*timeout`),
		// HTTP 超时
		regexp.MustCompile(`(?i)(http|request|response|client|server)\s*timeout`),
	}
)

// NewErrorTypeDetector 创建错误类型检测器
func NewErrorTypeDetector() *ErrorTypeDetector {
	return &ErrorTypeDetector{
		patterns: []errorPattern{
			{
				name:    "npm_lifecycle_error",
				regex:   regexp.MustCompile(`(?i)npm\s+error\s+(lifecycle\s+script|command\s+failed|code\s+\d+)`),
				extractor: func(matches []string) (string, string) {
					return "npm.lifecycle_error", "npm lifecycle script failed"
				},
				priority: 1,
			},
			{
				name:    "database_error",
				regex:   regexp.MustCompile(`(?i)(sql|db|database|postgres|mysql|mongodb|redis|elastic|mariadb)`),
				extractor: func(matches []string) (string, string) {
					return "database.error", extractMessage(matches[0])
				},
				priority: 10,
			},
			{
				name:    "network_error",
				regex:   regexp.MustCompile(`(?i)(connection|timeout|http|network|dns|tls|ssl|socket|port|bind|accept|connect)`),
				extractor: func(matches []string) (string, string) {
					return "network.error", extractMessage(matches[0])
				},
				priority: 20,
			},
			{
				name:    "timeout_error",
				regex:   regexp.MustCompile(`(?i)(timeout|timed?\s*out)`),
				extractor: func(matches []string) (string, string) {
					return "timeout.error", "operation timed out"
				},
				priority: 5,
			},
			{
				name:    "java_error",
				regex:   regexp.MustCompile(`(?i)(java|javax|org\.springframework|org\.hibernate|org\.apache\.tomcat|org\.eclipse\.jetty|com\.fasterxml\.jackson)`),
				extractor: func(matches []string) (string, string) {
					return "java.error", extractMessage(matches[0])
				},
				priority: 30,
			},
			{
				name:    "python_error",
				regex:   regexp.MustCompile(`(?i)(django|flask|requests|numpy|pandas|sqlalchemy|python)`),
				extractor: func(matches []string) (string, string) {
					return "python.error", extractMessage(matches[0])
				},
				priority: 30,
			},
			{
				name:    "node_error",
				regex:   regexp.MustCompile(`(?i)(node|express|mongoose|npm|javascript|typescript|webpack|babel)`),
				extractor: func(matches []string) (string, string) {
					return "node.error", extractMessage(matches[0])
				},
				priority: 30,
			},
			{
				name:    "go_error",
				regex:   regexp.MustCompile(`(?i)(go|golang|gorm|labstack|uber)`),
				extractor: func(matches []string) (string, string) {
					return "go.error", extractMessage(matches[0])
				},
				priority: 30,
			},
			{
				name:    "dotnet_error",
				regex:   regexp.MustCompile(`(?i)(dotnet|c#|asp\.net|entityframework|microsoft\.net|\.NET\w)`),
				extractor: func(matches []string) (string, string) {
					return "dotnet.error", extractMessage(matches[0])
				},
				priority: 30,
			},
		},
	}
}

// DetectErrorType 检测错误类型和消息
// 返回: errorType, errorMessage, category
func (d *ErrorTypeDetector) DetectErrorType(body string) (errorType, errorMessage string, category ErrorTypeCategory) {
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return "", "", CategoryUnknown
	}

	lines := strings.Split(trimmed, "\n")
	firstLine := strings.TrimSpace(lines[0])

	// 1. 优先检测 npm 错误
	if strings.Contains(trimmed, "npm error") {
		return "npm.lifecycle_error", extractNpmErrorMessage(trimmed), CategoryExternal
	}

	// 2. 检测超时错误
	for _, pattern := range timeoutPatterns {
		if pattern.MatchString(trimmed) {
			return "timeout.error", "operation timed out", CategoryTimeout
		}
	}

	// 3. 按优先级检测
	errorType, msg := d.detectByPriority(firstLine)
	if errorType != "" {
		return errorType, msg, categorizeErrorType(errorType)
	}

	// 4. 检测数据库错误
	for _, pattern := range dbPatterns {
		if pattern.MatchString(trimmed) {
			return "database.error", extractMessage(trimmed), CategoryDatabase
		}
	}

	// 5. 检测网络错误
	for _, pattern := range networkPatterns {
		if pattern.MatchString(trimmed) {
			return "network.error", extractMessage(trimmed), CategoryNetwork
		}
	}

	// 6. 检测语言特定错误
	if d.detectLanguageError(trimmed, javaPatterns) != "" {
		return d.detectLanguageError(trimmed, javaPatterns), extractMessage(trimmed), CategoryRuntime
	}
	if d.detectLanguageError(trimmed, pythonPatterns) != "" {
		return d.detectLanguageError(trimmed, pythonPatterns), extractMessage(trimmed), CategoryRuntime
	}
	if d.detectLanguageError(trimmed, nodePatterns) != "" {
		return d.detectLanguageError(trimmed, nodePatterns), extractMessage(trimmed), CategoryRuntime
	}
	if d.detectLanguageError(trimmed, goPatterns) != "" {
		return d.detectLanguageError(trimmed, goPatterns), extractMessage(trimmed), CategoryRuntime
	}
	if d.detectLanguageError(trimmed, dotnetPatterns) != "" {
		return d.detectLanguageError(trimmed, dotnetPatterns), extractMessage(trimmed), CategoryRuntime
	}

	// 7. 兜底：通用错误
	for _, pattern := range genericErrorPatterns {
		matches := pattern.FindStringSubmatch(firstLine)
		if len(matches) >= 2 {
			errorType = matches[1]
			if len(matches) >= 3 {
				msg = matches[2]
			}
			if msg == "" {
				msg = errorType
			}
			return strings.ToLower(errorType) + ".error", strings.TrimSpace(msg), CategoryUnknown
		}
	}

	// 8. 如果是 error/fatal 级别日志但无法识别具体类型
	level := strings.ToLower(firstLine)
	if strings.HasPrefix(level, "error") || strings.HasPrefix(level, "fatal") || strings.HasPrefix(level, "panic") {
		return "log.error", firstLine, CategoryRuntime
	}

	return "", "", CategoryUnknown
}

// detectByPriority 按优先级检测错误
func (d *ErrorTypeDetector) detectByPriority(firstLine string) (string, string) {
	// 按优先级排序
	type scoredPattern struct {
		pattern  errorPattern
		matched  bool
		matches  []string
	}

	var scored []scoredPattern
	for _, p := range d.patterns {
		matches := p.regex.FindStringSubmatch(firstLine)
		scored = append(scored, scoredPattern{
			pattern: p,
			matched: len(matches) > 0,
			matches: matches,
		})
	}

	// 找最高优先级匹配
	for _, s := range scored {
		if s.matched {
			errorType, msg := s.pattern.extractor(s.matches)
			if errorType != "" {
				return errorType, msg
			}
		}
	}

	return "", ""
}

// detectLanguageError 检测特定语言的错误
func (d *ErrorTypeDetector) detectLanguageError(body string, patterns []*regexp.Regexp) string {
	for _, pattern := range patterns {
		if pattern.MatchString(body) {
			match := pattern.FindString(body)
			// 提取错误类型名
			parts := strings.Split(match, ".")
			if len(parts) > 0 {
				return strings.ToLower(parts[len(parts)-1])
			}
			return strings.ToLower(match)
		}
	}
	return ""
}

// extractMessage 提取错误消息
func extractMessage(body string) string {
	lines := strings.Split(body, "\n")
	firstLine := strings.TrimSpace(lines[0])
	// 移除前缀
	if idx := strings.Index(firstLine, ":"); idx > 0 {
		return strings.TrimSpace(firstLine[idx+1:])
	}
	if idx := strings.Index(firstLine, "-"); idx > 0 {
		return strings.TrimSpace(firstLine[idx+1:])
	}
	return firstLine
}

// extractNpmErrorMessage 提取 npm 错误消息
func extractNpmErrorMessage(body string) string {
	lines := strings.Split(body, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "npm error") {
			// 移除 "npm error" 前缀
			msg := strings.TrimPrefix(trimmed, "npm error")
			msg = strings.TrimSpace(msg)
			if msg != "" {
				return msg
			}
		}
	}
	// 尝试提取 code
	codeMatch := regexp.MustCompile(`npm error code (\d+)`).FindStringSubmatch(body)
	if len(codeMatch) >= 2 {
		return "npm error code " + codeMatch[1]
	}
	return "npm error"
}

// categorizeErrorType 根据错误类型返回分类
func categorizeErrorType(errorType string) ErrorTypeCategory {
	lower := strings.ToLower(errorType)
	switch {
	case strings.Contains(lower, "timeout"):
		return CategoryTimeout
	case strings.Contains(lower, "database") || strings.Contains(lower, "sql") || strings.Contains(lower, "db"):
		return CategoryDatabase
	case strings.Contains(lower, "network") || strings.Contains(lower, "connection") || strings.Contains(lower, "http"):
		return CategoryNetwork
	case strings.Contains(lower, "permission") || strings.Contains(lower, "forbidden") || strings.Contains(lower, "unauthorized"):
		return CategoryPermission
	case strings.Contains(lower, "security") || strings.Contains(lower, "injection") || strings.Contains(lower, "xss"):
		return CategorySecurity
	case strings.Contains(lower, "config") || strings.Contains(lower, "invalid") || strings.Contains(lower, "malformed"):
		return CategoryConfig
	case strings.Contains(lower, "syntax") || strings.Contains(lower, "parse"):
		return CategorySyntax
	default:
		return CategoryRuntime
	}
}

// EnhancedExtractErrorFields 使用增强的错误检测器提取错误字段
func EnhancedExtractErrorFields(record AgentPullRecord, body string) (string, string, ErrorTypeCategory) {
	detector := NewErrorTypeDetector()
	errorType, errorMessage, category := detector.DetectErrorType(body)
	return errorType, errorMessage, category
}

// 全局错误检测器实例
var globalErrorDetector = NewErrorTypeDetector()

// ExtractErrorFieldsWithCategory 提取错误字段并返回分类
func ExtractErrorFieldsWithCategory(record AgentPullRecord, body string) (errorType, errorMessage string, category ErrorTypeCategory) {
	return globalErrorDetector.DetectErrorType(body)
}
