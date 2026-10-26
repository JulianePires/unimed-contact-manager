import { useState } from 'react';

interface Feedback {
  attempt: number;
  formError?: string | undefined;
}

/** Estado do `FormErrorSummary`: cada envio com erro o reexibe (com erro geral, se houver) e o foca. */
export function useFormFeedback() {
  const [feedback, setFeedback] = useState<Feedback>({ attempt: 0 });

  return {
    attempt: feedback.attempt,
    formError: feedback.formError,
    report: (formError?: string) => {
      setFeedback((previous) => ({ attempt: previous.attempt + 1, formError }));
    },
  };
}
