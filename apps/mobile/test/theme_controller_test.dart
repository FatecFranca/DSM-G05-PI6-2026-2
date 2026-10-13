import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:estoque_inteligente/application/theme_controller.dart';

class MemoryThemeStore implements ThemePreferenceStore {
  String? value;
  bool fail = false;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String value) async {
    if (fail) throw StateError('Unavailable storage');
    this.value = value;
  }
}

class DelayedThemeStore extends MemoryThemeStore {
  final ready = Completer<String?>();
  @override
  Future<String?> read() => ready.future;
}

void main() {
  test('persiste e restaura tema; valor inválido segue o sistema', () async {
    final store = MemoryThemeStore();
    final first = ThemeController(store);
    await first.select(ThemeMode.dark);
    final second = ThemeController(store);
    await second.restore();
    expect(second.mode, ThemeMode.dark);
    store.value = 'invalid';
    await second.restore();
    expect(second.mode, ThemeMode.system);
    first.dispose();
    second.dispose();
  });
  test('restauração atrasada não substitui escolha do usuário', () async {
    final store = DelayedThemeStore();
    final controller = ThemeController(store);
    final restoring = controller.restore();
    await controller.select(ThemeMode.light);
    store.ready.complete('dark');
    await restoring;
    expect(controller.mode, ThemeMode.light);
    controller.dispose();
  });
  test(
    'gravações rápidas mantêm a última escolha e falha não bloqueia tema',
    () async {
      final store = MemoryThemeStore();
      final controller = ThemeController(store);
      await Future.wait([
        controller.select(ThemeMode.dark),
        controller.select(ThemeMode.light),
      ]);
      expect(store.value, 'light');
      store.fail = true;
      await controller.select(ThemeMode.dark);
      expect(controller.mode, ThemeMode.dark);
      expect(controller.notice, isNotNull);
      controller.dispose();
    },
  );
}
