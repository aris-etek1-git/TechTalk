import { useState } from "react";
import { ArrowRight, Bot, BookOpen, Check, Lightbulb, Send, Sparkles } from "lucide-react";
import { useAppStore } from "../app/store";

const SUGGESTIONS = ["Explique-moi BFS comme à un débutant", "Donne-moi un exercice React", "Quel projet construire avec Python ?"];

export function AiScreen() {
  const { interests, user } = useAppStore();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: `Bonjour ${user?.name?.split(" ")[0] || "Tech Talker"}. Je connais vos intérêts (${interests.slice(0, 3).join(", ") || "à définir"}). On commence par un indice, une question guidée ou une explication complète ?` },
  ]);

  const send = (value = prompt) => {
    const clean = value.trim();
    if (!clean) return;
    setMessages((current) => [...current, { role: "user", text: clean }, { role: "assistant", text: "Commence par formuler ce que tu comprends déjà. Indice : identifie les données d'entrée, la transformation attendue et le cas limite. Je te donnerai la suite sans sauter directement à la solution." }]);
    setPrompt("");
  };

  return <div className="flex-1 overflow-y-auto tt-scrollbar"><div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_300px] md:px-8"><main className="min-w-0"><header className="mb-6 tt-fade-up"><p className="tt-label mb-3">Assistant / apprendre avec contexte</p><h1 className="text-3xl font-extrabold md:text-5xl">Une IA qui vous fait réfléchir.</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Pas un chatbot générique : un compagnon qui adapte ses explications à vos objectifs, votre niveau et vos projets.</p></header><section className="tt-card flex min-h-[420px] flex-col p-4 sm:p-6"><div className="flex-1 space-y-4 overflow-y-auto pb-5">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${message.role === "assistant" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}>{message.role === "assistant" ? <Bot size={15} /> : <span className="text-[11px] font-bold">VOUS</span>}</span><p className={`max-w-[80%] p-3 text-sm leading-relaxed ${message.role === "assistant" ? "bg-surface-2" : "bg-primary text-primary-foreground"}`}>{message.text}</p></div>)}</div><div className="flex gap-2 border-t border-border pt-4"><input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => event.key === "Enter" && send()} placeholder="Posez une question sur votre apprentissage..." className="tt-field min-w-0 flex-1 rounded-none px-4 py-3 text-sm" /><button onClick={() => send()} className="tt-btn tt-btn-brand p-3" aria-label="Envoyer"><Send size={16} /></button></div></section><div className="mt-4 flex flex-wrap gap-2">{SUGGESTIONS.map((suggestion) => <button key={suggestion} onClick={() => send(suggestion)} className="tt-chip text-left text-[11px]">{suggestion}</button>)}</div></main><aside className="space-y-4"><div className="tt-card p-5"><div className="mb-4 flex items-center gap-2"><Sparkles className="text-primary" size={17} /><h2 className="font-extrabold">Mode pédagogique</h2></div><div className="space-y-2 text-xs"><div className="flex items-center gap-2 bg-primary/10 p-3 text-primary"><Check size={14} /> Indice avant solution</div><div className="flex items-center gap-2 bg-surface-2 p-3 text-muted-foreground"><Lightbulb size={14} /> Questions guidées</div><div className="flex items-center gap-2 bg-surface-2 p-3 text-muted-foreground"><BookOpen size={14} /> Ressources liées</div></div></div><div className="tt-card p-5"><p className="tt-label mb-3">Contexte actif</p><p className="text-sm font-semibold">Objectif : maîtriser les graphes</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">L'assistant peut relier vos intérêts, votre progression, vos projets et les ressources sauvegardées.</p><button className="tt-btn tt-btn-ghost mt-5 gap-1 px-3 py-2 text-xs">Voir le parcours <ArrowRight size={13} /></button></div></aside></div></div>;
}
