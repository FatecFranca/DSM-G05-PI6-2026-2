import 'package:flutter/material.dart';
import '../../application/theme_controller.dart';

class ThemePicker extends StatelessWidget {
  const ThemePicker({super.key});
  @override
  Widget build(BuildContext context) {
    final controller = ThemeScope.of(context);
    if (controller == null) return const SizedBox.shrink();
    return PopupMenuButton<ThemeMode>(
      tooltip: 'Tema da interface',
      initialValue: controller.mode,
      icon: Icon(switch (controller.mode) {
        ThemeMode.light => Icons.light_mode_outlined,
        ThemeMode.dark => Icons.dark_mode_outlined,
        ThemeMode.system => Icons.brightness_auto_outlined,
      }),
      onSelected: (mode) async {
        await controller.select(mode);
        if (context.mounted && controller.notice != null) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(controller.notice!)));
        }
      },
      itemBuilder: (_) => [
        for (final entry in {
          ThemeMode.light: 'Claro',
          ThemeMode.dark: 'Escuro',
          ThemeMode.system: 'Sistema',
        }.entries)
          CheckedPopupMenuItem(
            value: entry.key,
            checked: controller.mode == entry.key,
            child: Text(entry.value),
          ),
      ],
    );
  }
}
