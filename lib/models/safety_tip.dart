enum IconIdentifier { fire, medical, disaster, road, security }

class SafetyTip {
  final String title;
  final String subtitle;
  final IconIdentifier icon;

  const SafetyTip({
    required this.title,
    required this.subtitle,
    required this.icon,
  });
}

// A tiny enum so we don't have to import Flutter's Icon type into our data file.
