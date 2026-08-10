# Generate a random, secure password for the database
resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Generate a random 32-byte key (Base64) for the AES-256-GCM encryption
resource "random_bytes" "encryption_key" {
  length = 32
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name = "${var.project_name}-${var.environment}-secrets"
}

resource "aws_secretsmanager_secret_version" "app_secrets_version" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    DATABASE_URL        = "postgres://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.main.endpoint}/cardsdb"
    CARD_ENCRYPTION_KEY = random_bytes.encryption_key.base64
  })
}
