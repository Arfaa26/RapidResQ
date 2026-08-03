import 'dart:async';
import 'dart:io';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/incident.dart';

class IncidentService {
  static final IncidentService _instance = IncidentService._internal();

  factory IncidentService() => _instance;

  IncidentService._internal() {
    _incidentController.add(List.unmodifiable(_incidents));
  }

  static IncidentService get instance => _instance;

  static const String _cloudName = 'wl1ffxt0';
  static const String _uploadPreset = 'rapidresq_unsigned';

  final List<Incident> _incidents = [];
  final StreamController<List<Incident>> _incidentController =
      StreamController<List<Incident>>.broadcast();

  Future<String> uploadPhoto(File imageFile) async {
    final url = Uri.parse(
      'https://api.cloudinary.com/v1_1/$_cloudName/image/upload',
    );

    final request = http.MultipartRequest('POST', url)
      ..fields['upload_preset'] = _uploadPreset
      ..files.add(await http.MultipartFile.fromPath('file', imageFile.path));

    final response = await request.send();
    final responseBody = await response.stream.bytesToString();

    if (response.statusCode == 200) {
      final data = jsonDecode(responseBody);
      return data['secure_url'];
    } else {
      throw Exception('Photo upload failed: $responseBody');
    }
  }

  Future<String> uploadIncidentData(Incident incident) async {
    final url = Uri.parse(
      'https://api.cloudinary.com/v1_1/$_cloudName/raw/upload',
    );

    final jsonBody = jsonEncode(incident.toMap());
    final request = http.MultipartRequest('POST', url)
      ..fields['upload_preset'] = _uploadPreset
      ..files.add(
        http.MultipartFile.fromString(
          'file',
          jsonBody,
          filename: 'incident_${DateTime.now().millisecondsSinceEpoch}.json',
        ),
      );

    final response = await request.send();
    final responseBody = await response.stream.bytesToString();

    if (response.statusCode == 200) {
      final data = jsonDecode(responseBody);
      return data['secure_url'];
    } else {
      throw Exception('Incident data upload failed: $responseBody');
    }
  }

  Future<void> reportIncident(Incident incident) async {
    try {
      var updatedIncident = incident;

      final photoUrl = incident.photoUrl;
      final isRemotePhoto =
          photoUrl != null &&
          Uri.tryParse(photoUrl)?.hasScheme == true &&
          (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'));

      if (photoUrl != null && !isRemotePhoto) {
        final uploadedUrl = await uploadPhoto(File(photoUrl));
        updatedIncident = Incident(
          id: incident.id,
          category: incident.category,
          description: incident.description,
          latitude: incident.latitude,
          longitude: incident.longitude,
          status: incident.status,
          photoUrl: uploadedUrl,
          priority: incident.priority,
          createdAt: incident.createdAt,
        );
      }

      await uploadIncidentData(updatedIncident);
      _incidents.insert(0, updatedIncident);
      _incidentController.add(List.unmodifiable(_incidents));
    } catch (e) {
      throw Exception('Unable to submit report: $e');
    }
  }

  Stream<List<Incident>> getIncidents() {
    return Stream<List<Incident>>.multi((controller) {
      controller.add(List.unmodifiable(_incidents));
      final subscription = _incidentController.stream.listen(
        controller.add,
        onError: controller.addError,
        onDone: controller.close,
      );
      controller.onCancel = subscription.cancel;
    }, isBroadcast: true);
  }

  void dispose() {
    _incidentController.close();
  }
}
