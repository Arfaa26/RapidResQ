class Incident {
  final String? id;
  final String category;
  final String description;
  final double latitude;
  final double longitude;
  final String status;
  final String? photoUrl;
  final String priority;
  final DateTime createdAt;

  Incident({
    this.id,
    required this.category,
    required this.description,
    required this.latitude,
    required this.longitude,
    this.status = 'Submitted',
    this.photoUrl,
    this.priority = 'Low',
    required this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'category': category,
      'description': description,
      'latitude': latitude,
      'longitude': longitude,
      'status': status,
      'photoUrl': photoUrl,
      'priority': priority,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  factory Incident.fromMap(String id, Map<String, dynamic> data) {
    final createdAtValue = data['createdAt'];
    DateTime parsedCreatedAt;

    if (createdAtValue is String) {
      parsedCreatedAt = DateTime.parse(createdAtValue);
    } else if (createdAtValue is DateTime) {
      parsedCreatedAt = createdAtValue;
    } else {
      parsedCreatedAt = DateTime.now();
    }

    return Incident(
      id: id,
      category: data['category'] ?? '',
      description: data['description'] ?? '',
      latitude: (data['latitude'] ?? 0).toDouble(),
      longitude: (data['longitude'] ?? 0).toDouble(),
      status: data['status'] ?? 'Submitted',
      photoUrl: data['photoUrl'],
      priority: data['priority'] ?? 'Low',
      createdAt: parsedCreatedAt,
    );
  }
}
