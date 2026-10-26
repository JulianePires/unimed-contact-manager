import { useEffect, useEffectEvent, useState } from 'react';

import { searchTerm } from '../api';

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Busca da lista (RF07, RN16): o termo vive só em memória, nunca na URL. A consulta parte 300 ms
 * após a última tecla ou na hora, ao enviar; `onTermChange` volta a lista para a primeira página.
 */
export function useContactSearch(onTermChange: () => void) {
  const [input, setInput] = useState('');
  const [term, setTerm] = useState<string | undefined>();

  const apply = (raw: string) => {
    const next = searchTerm(raw);
    if (next === term) return;
    setTerm(next);
    onTermChange();
  };
  const applyAfterDebounce = useEffectEvent(apply);

  useEffect(() => {
    const timer = setTimeout(() => {
      applyAfterDebounce(input);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [input]);

  return {
    input,
    term,
    setInput,
    submit: () => {
      apply(input);
    },
    clear: () => {
      setInput('');
      apply('');
    },
  };
}
