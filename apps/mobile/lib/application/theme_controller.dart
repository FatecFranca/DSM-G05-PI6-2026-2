import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class ThemePreferenceStore {
  Future<String?> read();
  Future<void> write(String value);
}

class DeviceThemePreferenceStore implements ThemePreferenceStore {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  @override
  Future<String?> read() => _storage.read(key: 'estoque_theme');
  @override
  Future<void> write(String value) =>
      _storage.write(key: 'estoque_theme', value: value);
}

class ThemeController extends ChangeNotifier {
  ThemeController(this.store);
  final ThemePreferenceStore store;
  ThemeMode mode = ThemeMode.system;
  String? notice;
  int _revision = 0;
  bool _disposed = false;
  Future<void> _writes = Future.value();

  Future<void> restore() async {
    final revision = _revision;
    try {
      final saved = await store.read();
      if (_disposed || revision != _revision) return;
      mode = ThemeMode.values.firstWhere(
        (value) => value.name == saved,
        orElse: () => ThemeMode.system,
      );
      notifyListeners();
    } catch (_) {
      /* A preference must never prevent sign-in. */
    }
  }

  Future<void> select(ThemeMode value) {
    _revision++;
    mode = value;
    notice = null;
    notifyListeners();
    _writes = _writes.then((_) async {
      try {
        await store.write(value.name);
      } catch (_) {
        if (!_disposed) {
          notice =
              'Tema aplicado nesta sessão. Não foi possível salvar a preferência.';
          notifyListeners();
        }
      }
    });
    return _writes;
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

class ThemeScope extends InheritedNotifier<ThemeController> {
  const ThemeScope({
    super.key,
    required ThemeController controller,
    required super.child,
  }) : super(notifier: controller);
  static ThemeController? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<ThemeScope>()?.notifier;
}
