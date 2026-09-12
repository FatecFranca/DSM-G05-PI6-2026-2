import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class InventoryApiClient {
  InventoryApiClient({required this.baseUri, http.Client? httpClient})
    : _httpClient = httpClient ?? http.Client();

  final Uri baseUri;
  final http.Client _httpClient;
  String? sessionToken;
  void Function()? onSessionExpired;

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, String?> query = const {},
  }) async => (await request('GET', path, query: query)).data;

  Future<ApiResponse> postJson(String path, Map<String, dynamic> body) =>
      request('POST', path, body: body);

  Future<ApiResponse> request(
    String method,
    String path, {
    Map<String, String?> query = const {},
    Map<String, dynamic>? body,
  }) async {
    final tokenAtStart = sessionToken;
    final uri = baseUri.replace(
      path: path,
      queryParameters: {
        for (final entry in query.entries)
          if (entry.value != null && entry.value!.isNotEmpty)
            entry.key: entry.value!,
      },
    );

    late final http.Response response;
    final request = http.Request(method, uri)
      ..followRedirects = false
      ..headers.addAll({
        'Accept': 'application/json',
        'X-Requested-With': 'EstoqueInteligente',
        if (tokenAtStart != null) 'Cookie': 'estoque_session=$tokenAtStart',
      });
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    try {
      response = await _httpClient
          .send(request)
          .then(http.Response.fromStream)
          .timeout(const Duration(seconds: 15));
    } on Exception {
      throw const ApiException(
        'Não foi possível acessar a API. Confirme se o servidor está ativo.',
      );
    }

    if (response.statusCode == 401 &&
        tokenAtStart != null &&
        sessionToken == tokenAtStart) {
      onSessionExpired?.call();
    }

    try {
      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) {
        throw const FormatException('Resposta não é um objeto JSON.');
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(
          decoded['message'] is String
              ? decoded['message'] as String
              : 'Não foi possível concluir a solicitação.',
          statusCode: response.statusCode,
        );
      }
      return ApiResponse(decoded, response.headers);
    } on FormatException {
      throw const ApiException('A API retornou uma resposta inválida.');
    }
  }

  void close() => _httpClient.close();
}

class ApiResponse {
  const ApiResponse(this.data, this.headers);
  final Map<String, dynamic> data;
  final Map<String, String> headers;
}
