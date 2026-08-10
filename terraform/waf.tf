# Rate limiting for GET /cards:search (and /cards/search), the one endpoint
# with real card-enumeration risk — last4 only has 10,000 possible values.
# Lives at the ALB edge instead of in the app: evaluated once per request
# before it ever reaches an ECS task, so it's correct regardless of how many
# replicas are running. The in-process express-rate-limit this replaces was
# only ever accurate for exactly 1 replica — see DECISIONS.md §7.
resource "aws_wafv2_web_acl" "main" {
  name        = "${var.project_name}-waf-${var.environment}"
  description = "Rate limiting for the Cards API ALB"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit-search"
    priority = 1

    action {
      block {
        custom_response {
          response_code            = 429
          custom_response_body_key = "rate-limit-exceeded"
        }
      }
    }

    statement {
      rate_based_statement {
        # 150 requests / 5-minute window per IP ≈ the 30/min the app-level
        # limiter used to enforce. WAF's rate window is fixed at 5 minutes.
        limit              = 150
        aggregate_key_type = "IP"

        scope_down_statement {
          or_statement {
            statement {
              byte_match_statement {
                search_string         = "/cards:search"
                positional_constraint = "STARTS_WITH"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }
            statement {
              byte_match_statement {
                search_string         = "/cards/search"
                positional_constraint = "STARTS_WITH"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-rate-limit-search"
    }
  }

  custom_response_body {
    key          = "rate-limit-exceeded"
    content_type = "APPLICATION_JSON"
    content = jsonencode({
      type   = "https://api.cards.local/errors/rate-limit-exceeded"
      title  = "Too Many Requests"
      status = 429
      detail = "Rate limit exceeded for last4 search. Try again shortly."
    })
  }

  visibility_config {
    sampled_requests_enabled   = true
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-waf-${var.environment}"
  }
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}
