# Scales the ECS service by ALB request volume, not CPU — this API's
# bottleneck under load is request throughput, not compute, so tracking
# ALBRequestCountPerTarget reacts to the thing that actually matters.
resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 6
  min_capacity       = 2 # never below the assessment's "≥2 replicas" requirement
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "requests_per_target" {
  name               = "${var.project_name}-scale-by-requests"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.main.arn_suffix}/${aws_lb_target_group.app.arn_suffix}"
    }
    # Requests/min per task before scaling out. Tune from real traffic —
    # this is a starting number, not a measured one.
    target_value       = 1000
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}
