import 'package:flutter/material.dart';

abstract final class AppColors {
  static const brand = Color(0xFF0C7767);
  static const brandDark = Color(0xFF075F53);
  static const brandSoft = Color(0xFFE8F5F1);
  static const canvas = Color(0xFFF4F7F6);
  static const ink = Color(0xFF19332E);
  static const muted = Color(0xFF71817C);
  static const line = Color(0xFFE1E9E6);
  static const danger = Color(0xFFC14242);
  static const warning = Color(0xFFB8780A);
  static const blue = Color(0xFF2774B9);
}

abstract final class AppTheme {
  static ThemeData light() {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: AppColors.brand,
          brightness: Brightness.light,
          surface: Colors.white,
        ).copyWith(
          primary: AppColors.brand,
          onPrimary: Colors.white,
          error: AppColors.danger,
          onSurface: AppColors.ink,
          outline: AppColors.line,
        );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.canvas,
      appBarTheme: const AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: AppColors.canvas,
        foregroundColor: AppColors.ink,
      ),
      cardTheme: const CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
          side: BorderSide(color: AppColors.line),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 13,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(11),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(11),
          borderSide: const BorderSide(color: AppColors.line),
        ),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: AppColors.brandSoft,
        elevation: 0,
      ),
      dividerTheme: const DividerThemeData(color: AppColors.line),
    );
  }
}
