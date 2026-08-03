import 'package:flutter/material.dart';
import 'dart:async';
import 'emergency_hub_screen.dart';
import 'report_incident_screen.dart';

class SOSHomeScreen extends StatefulWidget {
  const SOSHomeScreen({super.key});

  @override
  State<SOSHomeScreen> createState() => _SOSHomeScreenState();
}

class _SOSHomeScreenState extends State<SOSHomeScreen> {
  bool _isHolding = false;
  bool _holdCompleted = false;
  double _progress = 0.0;
  Timer? _holdTimer;

  void _startHold() {
    _holdTimer?.cancel();
    setState(() {
      _isHolding = true;
      _holdCompleted = false;
      _progress = 0.0;
    });

    _holdTimer = Timer.periodic(const Duration(milliseconds: 50), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      setState(() {
        _progress += 1 / 60;
      });

      if (_progress >= 1.0) {
        timer.cancel();
        _openEmergencyHub();
      }
    });
  }

  void _cancelHold() {
    _holdTimer?.cancel();
    if (_holdCompleted) return;

    setState(() {
      _isHolding = false;
      _progress = 0.0;
    });
  }

  void _openEmergencyHub() {
    _holdCompleted = true;
    _holdTimer?.cancel();

    setState(() {
      _isHolding = false;
      _progress = 0.0;
    });

    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const EmergencyHubScreen()),
    );
  }

  @override
  void dispose() {
    _holdTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('RapidResQ'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'Hold to Alert',
              style: TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Press and hold the button for 3\nseconds to notify emergency services.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey, fontSize: 13),
            ),
            const SizedBox(height: 50),
            GestureDetector(
              onTapDown: (_) => _startHold(),
              onTapUp: (_) => _cancelHold(),
              onTapCancel: () => _cancelHold(),
              child: Semantics(
                button: true,
                label: 'SOS hold button',
                hint: 'Hold for 3 seconds to open emergency hub',
                child: SizedBox(
                  width: 250,
                  height: 250,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox(
                        width: 250,
                        height: 250,
                        child: CircularProgressIndicator(
                          value: _progress,
                          strokeWidth: 7,
                          backgroundColor: const Color(0xFF3A0000),
                          valueColor: const AlwaysStoppedAnimation<Color>(
                            Color(0xFFFF2D55),
                          ),
                        ),
                      ),
                      AnimatedScale(
                        scale: _isHolding ? 0.94 : 1.0,
                        duration: const Duration(milliseconds: 120),
                        child: Container(
                          width: 200,
                          height: 200,
                          decoration: const BoxDecoration(
                            color: Color(0xFFFF2D55),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Color(0x663A0000),
                                blurRadius: 28,
                                spreadRadius: 12,
                              ),
                            ],
                          ),
                          alignment: Alignment.center,
                          child: const Text(
                            'SOS\nHOLD',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 26,
                              fontWeight: FontWeight.bold,
                              height: 1.25,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const ReportIncidentScreen(),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1A1A1A),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  vertical: 14,
                  horizontal: 24,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: const Text('Report an Issue'),
            ),
          ],
        ),
      ),
    );
  }
}
