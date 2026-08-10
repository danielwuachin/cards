resource "aws_secretsmanager_secret" "app_secrets" {
  name = "${var.project_name}-${var.environment}-secrets"
}

resource "aws_secretsmanager_secret_version" "app_secrets_version" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    DATABASE_URL        = "postgres://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/cardsdb"
    CARD_ENCRYPTION_KEY = var.card_encryption_key
  })
}
