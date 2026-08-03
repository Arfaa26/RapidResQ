import 'dart:async';
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import 'main_nav_screen.dart';

class VerifyIdentityScreen extends StatefulWidget {
  const VerifyIdentityScreen({super.key});

  @override
  State<VerifyIdentityScreen> createState() => _VerifyIdentityScreenState();
}

class _VerifyIdentityScreenState extends State<VerifyIdentityScreen> {
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  final _authService = AuthService();

  bool _codeSent = false;
  bool _isLoading = false;
  String _statusMessage = '';

  Future<void> _sendCode() async {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty) {
      setState(() => _statusMessage = 'Enter a valid phone number');
      return;
    }

    setState(() {
      _isLoading = true;
      _statusMessage = '';
    });

    await Future.delayed(const Duration(seconds: 1));
    final otp = await _authService.sendOtp(phone);

    setState(() {
      _isLoading = false;
      _codeSent = true;
      _statusMessage = 'Code sent! Check your SMS. (For now use $otp)';
    });
  }

  Future<void> _confirmCode() async {
    final code = _codeController.text.trim();

    setState(() => _isLoading = true);
    await Future.delayed(const Duration(milliseconds: 600));

    final verified = await _authService.verifyCode(code);
    if (verified) {
      _goToApp();
    } else {
      setState(() {
        _isLoading = false;
        _statusMessage = 'Incorrect code. Try again.';
      });
    }
  }

  void _goToApp() {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => const MainNavScreen()),
    );
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 40),
              const Icon(Icons.shield, color: Color(0xFFFF2D55), size: 40),
              const SizedBox(height: 20),
              const Text(
                'Verify Identity',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Your safety is our priority. Enter your\nmobile number to securely access\nemergency services.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey, fontSize: 13),
              ),
              const SizedBox(height: 32),

              if (!_codeSent) ...[
                TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: 'Phone Number',
                    hintText: '+91 (555) 000-0000',
                    labelStyle: const TextStyle(color: Colors.grey),
                    hintStyle: const TextStyle(color: Colors.grey),
                    filled: true,
                    fillColor: const Color(0xFF1A1A1A),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ] else ...[
                TextField(
                  controller: _codeController,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: 'Enter Verification Code',
                    labelStyle: const TextStyle(color: Colors.grey),
                    filled: true,
                    fillColor: const Color(0xFF1A1A1A),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 12),

              if (_statusMessage.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    _statusMessage,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFFFF2D55),
                      fontSize: 12,
                    ),
                  ),
                ),

              ElevatedButton(
                onPressed: _isLoading
                    ? null
                    : (_codeSent ? _confirmCode : _sendCode),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFF2D55),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(
                        _codeSent ? 'Verify Code' : 'Send Verification Code',
                      ),
              ),

              const SizedBox(height: 16),
              const Text(
                'By continuing, you agree to receive an automated SMS\nfor verification. Message and data rates may apply.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey, fontSize: 10),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
