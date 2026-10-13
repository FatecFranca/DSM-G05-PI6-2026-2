import 'package:flutter/material.dart';

abstract final class AppColors {
  static const brand = Color(0xFF3157D5);
  static const brandDark = Color(0xFF203F9E);
  static const brandSoft = Color(0xFFEAF0FF);
  static const canvas = Color(0xFFF6F7FB);
  static const ink = Color(0xFF172033);
  static const muted = Color(0xFF667085);
  static const line = Color(0xFFE1E6EF);
  static const danger = Color(0xFFC14242);
  static const warning = Color(0xFFB8780A);
  static const blue = Color(0xFF2774B9);
}

abstract final class AppTheme {
  static ThemeData light() => _build(false);
  static ThemeData dark() => _build(true);

  static ThemeData _build(bool dark) {
    final canvas = dark ? const Color(0xFF0C1220) : AppColors.canvas;
    final surface = dark ? const Color(0xFF131D2E) : Colors.white;
    final primary = dark ? const Color(0xFF8BA8FF) : AppColors.brand;
    final line = dark ? const Color(0xFF29364B) : AppColors.line;
    final scheme =
        ColorScheme.fromSeed(
          seedColor: primary,
          brightness: dark ? Brightness.dark : Brightness.light,
        ).copyWith(
          primary: primary,
          onPrimary: dark ? const Color(0xFF0B1D4B) : Colors.white,
          surface: surface,
          onSurface: dark ? const Color(0xFFEDF2FA) : AppColors.ink,
          onSurfaceVariant: dark ? const Color(0xFFA4AFC2) : AppColors.muted,
          secondaryContainer: dark
              ? const Color(0xFF1C2D50)
              : AppColors.brandSoft,
          onSecondaryContainer: dark
              ? const Color(0xFFCAD8FF)
              : AppColors.brandDark,
          outlineVariant: line,
          outline: dark ? const Color(0xFF7183A3) : AppColors.muted,
          error: dark ? const Color(0xFFFFAAA3) : AppColors.danger,
        );
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: BorderSide(color: line),
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: canvas,
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: surface,
        foregroundColor: scheme.onSurface,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        color: surface,
        shape: shape,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 15,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: line),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: scheme.secondaryContainer,
        elevation: 0,
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: surface,
        indicatorColor: scheme.secondaryContainer,
      ),
      dividerTheme: DividerThemeData(color: line),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: scheme.inverseSurface,
      ),
    );
  }
}
