import 'package:flutter/material.dart';
import '../widgets/theme_picker.dart';
import '../../application/auth_controller.dart';
import '../../data/inventory_api_client.dart';
import '../widgets/app_brand.dart';

enum AuthMode { login, register, forgot, reset, change }

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.controller,
    this.initialMode = AuthMode.login,
    this.embedded = false,
  });
  final AuthController controller;
  final AuthMode initialMode;
  final bool embedded;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _current = TextEditingController();
  final _link = TextEditingController();
  late AuthMode _mode = widget.initialMode;
  bool _busy = false;
  bool _remember = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    for (final controller in [
      _name,
      _email,
      _password,
      _confirm,
      _current,
      _link,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _switch(AuthMode mode) {
    if (_busy) return;
    FocusScope.of(context).unfocus();
    _password.clear();
    _confirm.clear();
    _current.clear();
    _link.clear();
    _form.currentState?.reset();
    setState(() {
      _mode = mode;
      _error = null;
      _success = null;
    });
  }

  Future<void> _submit({bool logout = false}) async {
    if (_busy || (!logout && !(_form.currentState?.validate() ?? false))) {
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final auth = widget.controller;
      String? message;
      if (logout) {
        await auth.logout();
      } else {
        switch (_mode) {
          case AuthMode.login:
            await auth.login(_email.text, _password.text, _remember);
          case AuthMode.register:
            message = await auth.register(
              _name.text,
              _email.text,
              _password.text,
            );
          case AuthMode.forgot:
            message = await auth.forgotPassword(_email.text);
          case AuthMode.reset:
            message = await auth.resetPassword(_link.text, _password.text);
          case AuthMode.change:
            await auth.changePassword(_current.text, _password.text);
        }
      }
      if (mounted) {
        _password.clear();
        _confirm.clear();
        _current.clear();
        _link.clear();
        setState(() => _success = message);
      }
    } on Object catch (error) {
      if (mounted) {
        setState(
          () => _error = error is ApiException
              ? error.message
              : 'Não foi possível concluir. Tente novamente.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = widget.controller;
    final title = switch (_mode) {
      AuthMode.login => 'Que bom ter você de volta.',
      AuthMode.register => 'Crie sua conta.',
      AuthMode.forgot => 'Esqueceu sua senha?',
      AuthMode.reset => 'Uma nova senha.',
      AuthMode.change => 'Minha conta',
    };
    final label = switch (_mode) {
      AuthMode.login => 'Entrar na conta',
      AuthMode.register => 'Criar minha conta',
      AuthMode.forgot => 'Enviar link de recuperação',
      AuthMode.reset => 'Redefinir senha',
      AuthMode.change => 'Alterar senha',
    };
    final newPassword =
        _mode == AuthMode.register ||
        _mode == AuthMode.reset ||
        _mode == AuthMode.change;
    final duration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : Duration(milliseconds: 220);
    final content = SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: 460),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AppBrand(),
                SizedBox(height: 28),
                Card(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: AnimatedSwitcher(
                      duration: duration,
                      layoutBuilder: (current, previous) =>
                          current ?? SizedBox.shrink(),
                      child: Column(
                        key: ValueKey('${_mode.name}-${_success != null}'),
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            _success == null ? title : 'Tudo certo!',
                            style: TextStyle(
                              fontSize: 25,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          SizedBox(height: 12),
                          if (_mode == AuthMode.change && auth.user != null)
                            Text(
                              '${auth.user!.name}\n${auth.user!.email}',
                              style: TextStyle(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurfaceVariant,
                              ),
                            ),
                          if (_success != null) ...[
                            SizedBox(height: 24),
                            Icon(
                              Icons.check_circle_outline,
                              color: Theme.of(context).colorScheme.primary,
                              size: 48,
                            ),
                            SizedBox(height: 16),
                            Semantics(liveRegion: true, child: Text(_success!)),
                            SizedBox(height: 24),
                            FilledButton(
                              onPressed: () => _switch(AuthMode.login),
                              child: Text('Ir para o login'),
                            ),
                            if (_mode == AuthMode.forgot)
                              TextButton(
                                onPressed: () => _switch(AuthMode.reset),
                                child: Text('Já tenho o link de recuperação'),
                              ),
                          ] else ...[
                            if (_mode == AuthMode.login && auth.notice != null)
                              _Notice(auth.notice!),
                            if (_mode == AuthMode.forgot)
                              Text(
                                'Informe seu e-mail para receber um link de recuperação.',
                              ),
                            if (_mode == AuthMode.reset)
                              Text(
                                'Cole o link completo recebido por e-mail. Ele só pode ser usado uma vez.',
                              ),
                            if (_mode == AuthMode.change)
                              Padding(
                                padding: EdgeInsets.only(top: 12),
                                child: Text(
                                  'A troca de senha encerra todas as suas sessões.',
                                ),
                              ),
                            if (_error != null) _Notice(_error!, error: true),
                            SizedBox(height: 20),
                            Form(
                              key: _form,
                              child: AutofillGroup(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    if (_mode == AuthMode.register) ...[
                                      TextFormField(
                                        controller: _name,
                                        enabled: !_busy,
                                        decoration: InputDecoration(
                                          labelText: 'Seu nome',
                                        ),
                                        autofillHints: [AutofillHints.name],
                                        maxLength: 100,
                                        validator: (v) =>
                                            (v?.trim().length ?? 0) < 2
                                            ? 'Informe seu nome.'
                                            : null,
                                      ),
                                      SizedBox(height: 16),
                                    ],
                                    if (_mode == AuthMode.login ||
                                        _mode == AuthMode.register ||
                                        _mode == AuthMode.forgot) ...[
                                      TextFormField(
                                        controller: _email,
                                        enabled: !_busy,
                                        decoration: InputDecoration(
                                          labelText: 'E-mail',
                                        ),
                                        keyboardType:
                                            TextInputType.emailAddress,
                                        autocorrect: false,
                                        autofillHints: [AutofillHints.email],
                                        validator: (v) =>
                                            v == null ||
                                                v.trim().length > 254 ||
                                                !RegExp(
                                                  r'^\S+@\S+\.\S+$',
                                                ).hasMatch(v.trim())
                                            ? 'Informe um e-mail válido.'
                                            : null,
                                      ),
                                      SizedBox(height: 16),
                                    ],
                                    if (_mode == AuthMode.reset) ...[
                                      TextFormField(
                                        controller: _link,
                                        enabled: !_busy,
                                        decoration: InputDecoration(
                                          labelText: 'Link de recuperação',
                                        ),
                                        autocorrect: false,
                                        enableSuggestions: false,
                                        keyboardType: TextInputType.url,
                                        validator: (v) =>
                                            v == null || v.trim().isEmpty
                                            ? 'Cole o link recebido por e-mail.'
                                            : null,
                                      ),
                                      SizedBox(height: 16),
                                    ],
                                    if (_mode == AuthMode.change) ...[
                                      _passwordField('Senha atual', _current),
                                      SizedBox(height: 16),
                                    ],
                                    if (_mode != AuthMode.forgot) ...[
                                      _passwordField(
                                        newPassword ? 'Nova senha' : 'Senha',
                                        _password,
                                        isNew: newPassword,
                                      ),
                                      SizedBox(height: 16),
                                    ],
                                    if (newPassword) ...[
                                      _passwordField(
                                        'Confirmar senha',
                                        _confirm,
                                        isNew: true,
                                        confirmation: true,
                                      ),
                                      SizedBox(height: 16),
                                    ],
                                    if (_mode == AuthMode.login)
                                      CheckboxListTile(
                                        contentPadding: EdgeInsets.zero,
                                        controlAffinity:
                                            ListTileControlAffinity.leading,
                                        title: Text(
                                          'Manter conectado por 7 dias',
                                          style: TextStyle(fontSize: 13),
                                        ),
                                        value: _remember,
                                        onChanged: _busy
                                            ? null
                                            : (v) => setState(
                                                () => _remember = v ?? false,
                                              ),
                                      ),
                                    FilledButton(
                                      onPressed: _busy ? null : _submit,
                                      child: Padding(
                                        padding: EdgeInsets.symmetric(
                                          vertical: 13,
                                        ),
                                        child: Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            if (_busy &&
                                                !MediaQuery.disableAnimationsOf(
                                                  context,
                                                )) ...[
                                              SizedBox(
                                                width: 18,
                                                height: 18,
                                                child:
                                                    CircularProgressIndicator(
                                                      strokeWidth: 2,
                                                    ),
                                              ),
                                              SizedBox(width: 12),
                                            ],
                                            Flexible(
                                              child: Text(
                                                _busy ? 'Aguarde…' : label,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            if (_mode == AuthMode.login) ...[
                              TextButton(
                                onPressed: _busy
                                    ? null
                                    : () => _switch(AuthMode.forgot),
                                child: Text('Esqueci minha senha'),
                              ),
                              if (auth.registrationEnabled)
                                TextButton(
                                  onPressed: _busy
                                      ? null
                                      : () => _switch(AuthMode.register),
                                  child: Text('Criar conta'),
                                ),
                            ] else if (_mode != AuthMode.change)
                              TextButton(
                                onPressed: _busy
                                    ? null
                                    : () => _switch(AuthMode.login),
                                child: Text('Voltar para o login'),
                              ),
                            if (_mode == AuthMode.forgot)
                              TextButton(
                                onPressed: _busy
                                    ? null
                                    : () => _switch(AuthMode.reset),
                                child: Text('Já tenho o link de recuperação'),
                              ),
                            if (_mode == AuthMode.change) ...[
                              SizedBox(height: 20),
                              OutlinedButton.icon(
                                onPressed: _busy
                                    ? null
                                    : () => _submit(logout: true),
                                icon: Icon(Icons.logout),
                                label: Text('Sair da conta'),
                              ),
                            ],
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
                SizedBox(height: 24),
                Text(
                  'Estoque Inteligente · Grupo 05',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    return widget.embedded
        ? content
        : Scaffold(
            appBar: AppBar(actions: [ThemePicker(), SizedBox(width: 12)]),
            body: content,
          );
  }

  Widget _passwordField(
    String label,
    TextEditingController controller, {
    bool isNew = false,
    bool confirmation = false,
  }) => _PasswordField(
    key: ValueKey(label),
    controller: controller,
    label: label,
    enabled: !_busy,
    isNew: isNew,
    validator: (value) {
      if (value == null || value.isEmpty) return 'Informe a senha.';
      if (value.length > 128 || (isNew && value.length < 15)) {
        return 'Use de 15 a 128 caracteres.';
      }
      if (confirmation && value != _password.text) {
        return 'As senhas precisam ser iguais.';
      }
      return null;
    },
  );
}

class _PasswordField extends StatefulWidget {
  const _PasswordField({
    super.key,
    required this.controller,
    required this.label,
    required this.enabled,
    required this.isNew,
    required this.validator,
  });
  final TextEditingController controller;
  final String label;
  final bool enabled;
  final bool isNew;
  final FormFieldValidator<String> validator;
  @override
  State<_PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<_PasswordField> {
  bool _visible = false;
  @override
  Widget build(BuildContext context) => TextFormField(
    controller: widget.controller,
    enabled: widget.enabled,
    obscureText: !_visible,
    autocorrect: false,
    enableSuggestions: false,
    autofillHints: [
      widget.isNew ? AutofillHints.newPassword : AutofillHints.password,
    ],
    validator: widget.validator,
    decoration: InputDecoration(
      labelText: widget.label,
      helperText: widget.isNew
          ? 'De 15 a 128 caracteres. Use uma frase.'
          : null,
      helperMaxLines: 2,
      suffixIcon: IconButton(
        tooltip: _visible ? 'Ocultar senha' : 'Mostrar senha',
        onPressed: widget.enabled
            ? () => setState(() => _visible = !_visible)
            : null,
        icon: Icon(
          _visible ? Icons.visibility_off_outlined : Icons.visibility_outlined,
        ),
      ),
    ),
  );
}

class _Notice extends StatelessWidget {
  const _Notice(this.message, {this.error = false});
  final String message;
  final bool error;
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      margin: EdgeInsets.only(top: 16),
      padding: EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: error
            ? Color(0xFFFDEDED)
            : Theme.of(context).colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        message,
        style: TextStyle(
          color: error
              ? Theme.of(context).colorScheme.error
              : Theme.of(context).colorScheme.onSecondaryContainer,
        ),
      ),
    ),
  );
}

class AuthLoadingScreen extends StatelessWidget {
  const AuthLoadingScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: 412),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppBrand(),
              SizedBox(height: 32),
              for (final width in [240.0, 320.0, 320.0])
                Padding(
                  padding: EdgeInsets.only(bottom: 18),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      height: 38,
                      width: width,
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.outlineVariant,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
              if (!MediaQuery.disableAnimationsOf(context))
                LinearProgressIndicator(),
              SizedBox(height: 20),
              Text(
                'Verificando sua sessão…',
                semanticsLabel: 'Verificando sua sessão',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
