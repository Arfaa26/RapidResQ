import 'package:flutter/material.dart';
import 'screens/main_nav_screen.dart';
import 'screens/verify_identity_screen.dart';
import 'services/auth_service.dart';

void main() {
  runApp(const RapidResQApp());
}

class RapidResQApp extends StatefulWidget {
  const RapidResQApp({super.key});

  @override
  State<RapidResQApp> createState() => _RapidResQAppState();
}

class _RapidResQAppState extends State<RapidResQApp> {
  final AuthService _authService = AuthService();
  bool _isLoading = true;
  bool _isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }

  Future<void> _checkLoginStatus() async {
    final loggedIn = await _authService.isLoggedIn();
    if (mounted) {
      setState(() {
        _isLoggedIn = loggedIn;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const MaterialApp(
        home: Scaffold(
          backgroundColor: Colors.black,
          body: Center(
            child: CircularProgressIndicator(color: Color(0xFFFF2D55)),
          ),
        ),
      );
    }

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'RapidResQ',
      theme: ThemeData(
        scaffoldBackgroundColor: Colors.black,
        useMaterial3: true,
      ),
      home: _isLoggedIn ? const MainNavScreen() : const VerifyIdentityScreen(),
    );
  }
}
