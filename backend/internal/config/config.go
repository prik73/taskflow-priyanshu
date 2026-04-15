package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port        string
	Env         string
	DatabaseURL string
	JWTSecret   string
	JWTExpiry   int // hours
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		Env:         getEnv("ENV", "development"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		JWTExpiry:   24,
	}

	if v := os.Getenv("JWT_EXPIRY_HOURS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.JWTExpiry = n
		}
	}

	// Build DATABASE_URL from parts if not set directly
	if cfg.DatabaseURL == "" {
		host := getEnv("DB_HOST", "localhost")
		port := getEnv("DB_PORT", "5432")
		user := getEnv("DB_USER", "postgres")
		password := os.Getenv("DB_PASSWORD")
		dbname := getEnv("DB_NAME", "taskflow")
		sslmode := getEnv("DB_SSLMODE", "disable")
		cfg.DatabaseURL = fmt.Sprintf(
			"postgres://%s:%s@%s:%s/%s?sslmode=%s",
			user, password, host, port, dbname, sslmode,
		)
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required")
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}
