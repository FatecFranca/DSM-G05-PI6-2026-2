'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PackageSearch, Warehouse, ChartNoAxesCombined, Database, Sun, Moon, Monitor, Menu, ArrowUpRight, Settings2 } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { AccountMenu } from '@/components/auth/account-menu';
import appIcon from '@/app/icon.png';

const navigation = [
  ['/', 'Visão geral', LayoutDashboard], ['/produtos', 'Produtos', PackageSearch],
  ['/estoque', 'Estoque', Warehouse], ['/inteligencia', 'Inteligência', ChartNoAxesCombined],
  ['/dados', 'Qualidade dos dados', Database], ['/conta', 'Minha conta', Settings2],
];

export function ThemeControl() {
  const [theme, setTheme] = useState('system');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    function sync() {
      let selected = 'system';
      try { selected = localStorage.getItem('estoque-theme') || 'system'; } catch { /* Storage is optional. */ }
      setTheme(selected);
      document.documentElement.classList.toggle('dark', selected === 'dark' || (selected === 'system' && media.matches));
    }
    sync(); media.addEventListener('change', sync); window.addEventListener('storage', sync);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('storage', sync); };
  }, []);
  function change(value) {
    setTheme(value);
    try { localStorage.setItem('estoque-theme', value); } catch { /* Keep session preference. */ }
    document.documentElement.classList.toggle('dark', value === 'dark' || (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
  }
  return <div className="theme-switch" role="group" aria-label="Tema da interface">{[['light', Sun, 'Claro'], ['dark', Moon, 'Escuro'], ['system', Monitor, 'Sistema']].map(([value, Icon, label]) => <Button key={value} size="icon" variant="ghost" aria-label={`Tema ${label.toLowerCase()}`} aria-pressed={theme === value} title={label} onClick={() => change(value)}><Icon size={16} /></Button>)}</div>;
}

function Brand() {
  return <Link href="/" className="workspace-brand"><Image src={appIcon} width={42} height={42} alt="" priority /><span>Estoque<strong>inteligente<span className="brand-period">.</span></strong></span></Link>;
}

export function WorkspaceShell({ children }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isAuth = ['/login', '/cadastro', '/esqueci-senha', '/redefinir-senha'].includes(path);
  const current = navigation.find(([href]) => href === path)?.[1] || 'Estoque Inteligente';
  const links = <nav aria-label="Navegação principal"><p className="workspace-caption">ESPAÇO DE TRABALHO</p>{navigation.map(([href, label, Icon]) => <Link key={href} href={href} className="workspace-link" aria-current={path === href ? 'page' : undefined} onClick={() => setOpen(false)}><Icon size={18} /><span>{label}</span>{path === href && <span className="active-dot" />}</Link>)}</nav>;
  if (isAuth) return <><div className="auth-theme"><ThemeControl /></div>{children}</>;
  return <div className="workspace">
    <a className="skip-content" href="#workspace-content">Pular para o conteúdo</a>
    <aside className="workspace-sidebar"><Brand />{links}<div className="workspace-sidebar-note"><Database size={20} /><strong>Dados que orientam.</strong><p>Conheça a origem e a qualidade das suas análises.</p><Link href="/dados">Explorar a base <ArrowUpRight size={15} /></Link></div><div className="workspace-signature">ESTOQUE INTELIGENTE <span>PI · 2026</span></div></aside>
    <div className="workspace-body"><header className="workspace-topbar"><div className="flex items-center gap-3"><Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger asChild><Button className="workspace-menu" variant="ghost" size="icon" aria-label="Abrir navegação"><Menu /></Button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="workspace-overlay" /><Dialog.Content className="workspace-drawer"><Dialog.Title className="sr-only">Navegação</Dialog.Title><Dialog.Description className="sr-only">Acesse as áreas do estoque.</Dialog.Description><Brand />{links}<Dialog.Close asChild><Button variant="outline">Fechar navegação</Button></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root><span className="workspace-breadcrumb">Workspace <span>/</span> <strong>{current}</strong></span></div><div className="flex items-center gap-3"><ThemeControl /><AccountMenu /></div></header><div id="workspace-content" tabIndex={-1} className="workspace-content"><div key={path} className="motion-enter">{children}</div></div><footer className="workspace-footer"><span>Estoque Inteligente · Gestão com contexto</span><Link href="/dados">Fonte e metodologia ↗</Link></footer></div>
  </div>;
}
