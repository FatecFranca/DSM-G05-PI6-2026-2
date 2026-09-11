import Image from 'next/image';
import Link from 'next/link';
import { Boxes, ChartNoAxesCombined, ShieldCheck } from 'lucide-react';
import appIcon from '@/app/icon.png';

export function AuthShell({ children }) {
  return <main className="auth-shell">
    <section className="auth-story" aria-label="Estoque Inteligente">
      <Link href="/login" className="auth-brand"><Image src={appIcon} alt="" width={46} height={46} priority /><span>Estoque<strong>Inteligente</strong></span></Link>
      <div className="auth-story-content">
        <p className="auth-eyebrow">MENOS INCERTEZA. MAIS CONTROLE.</p>
        <h1>Seu estoque.<br />Seu próximo passo.</h1>
        <p>Transforme os dados do dia a dia em decisões mais claras para o seu negócio.</p>
        <ul className="auth-benefits">
          <li><Boxes aria-hidden="true" /><div><strong>Uma visão do que importa</strong><span>Produtos, níveis de estoque e alertas no mesmo lugar.</span></div></li>
          <li><ChartNoAxesCombined aria-hidden="true" /><div><strong>Planeje com mais contexto</strong><span>Acompanhe o histórico e as projeções de demanda.</span></div></li>
          <li><ShieldCheck aria-hidden="true" /><div><strong>Acesso pessoal e protegido</strong><span>Entre com sua conta para acompanhar a operação.</span></div></li>
        </ul>
      </div>
      <p className="auth-story-footer">Gestão inteligente de estoque e previsão de demanda</p>
    </section>
    <section className="auth-form-pane">{children}<p className="auth-footnote">Estoque Inteligente · Grupo 05</p></section>
  </main>;
}
