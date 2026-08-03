import 'dart:math';
import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  static const String _loggedInPhoneKey = 'logged_in_phone';
  static const String _isLoggedInKey = 'is_logged_in';
  static const String _pendingPhoneKey = 'pending_phone';
  static const String _pendingOtpKey = 'pending_otp';

  Future<SharedPreferences> _prefs() {
    return SharedPreferences.getInstance();
  }

  Future<bool> isLoggedIn() async {
    final prefs = await _prefs();
    return prefs.getBool(_isLoggedInKey) ?? false;
  }

  Future<String?> getLoggedInPhone() async {
    final prefs = await _prefs();
    return prefs.getString(_loggedInPhoneKey);
  }

  Future<void> signOut() async {
    final prefs = await _prefs();
    await prefs.setBool(_isLoggedInKey, false);
    await prefs.remove(_loggedInPhoneKey);
    await prefs.remove(_pendingPhoneKey);
    await prefs.remove(_pendingOtpKey);
  }

  Future<String> sendOtp(String phone) async {
    final prefs = await _prefs();
    final otp = (Random().nextInt(900000) + 100000).toString();
    await prefs.setString(_pendingPhoneKey, phone);
    await prefs.setString(_pendingOtpKey, otp);
    return otp;
  }

  Future<bool> verifyCode(String code) async {
    final prefs = await _prefs();
    final storedOtp = prefs.getString(_pendingOtpKey);
    final phone = prefs.getString(_pendingPhoneKey);

    if (storedOtp != null && phone != null && storedOtp == code) {
      await prefs.setBool(_isLoggedInKey, true);
      await prefs.setString(_loggedInPhoneKey, phone);
      await prefs.remove(_pendingOtpKey);
      await prefs.remove(_pendingPhoneKey);
      return true;
    }

    return false;
  }
}
