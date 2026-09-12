import 'package:flutter/foundation.dart';

abstract final class AppConfig {
  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');

  static Uri get apiBaseUri {
    if (_configuredBaseUrl.isNotEmpty) {
      final uri = Uri.parse(_configuredBaseUrl);
      if (!uri.hasAuthority ||
          !['https', 'http'].contains(uri.scheme) ||
          uri.userInfo.isNotEmpty ||
          uri.hasQuery ||
          uri.hasFragment) {
        throw StateError('API_BASE_URL inválida.');
      }
      if (kReleaseMode && uri.scheme != 'https') {
        throw StateError('A versão de produção exige API_BASE_URL HTTPS.');
      }
      return uri;
    }

    if (kReleaseMode) {
      throw StateError('Configure API_BASE_URL HTTPS para produção.');
    }

    final host = !kIsWeb && defaultTargetPlatform == TargetPlatform.android
        ? '10.0.2.2'
        : '127.0.0.1';
    return Uri.parse('http://$host:3333');
  }
}
