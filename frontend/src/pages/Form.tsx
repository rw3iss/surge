import { Component, createResource, createSignal, For, Show } from 'solid-js';
import { useParams } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { fetchForm, submitForm } from '../services/api';
import type { Form, FormQuestion } from '@surge/shared';

const FormPage: Component = () => {
  const params = useParams();
  const [answers, setAnswers] = createSignal<Record<string, unknown>>({});
  const [submitted, setSubmitted] = createSignal(false);

  const [form] = createResource(() => params.slug, async (slug) => {
    const response = await fetchForm(slug);
    return response.success ? response.data as Form : null;
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const formAnswers = Object.entries(answers()).map(([questionId, value]) => ({ questionId, value }));
    const response = await submitForm(params.slug, formAnswers);
    if (response.success) setSubmitted(true);
  };

  const updateAnswer = (questionId: string, value: unknown) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  return (
    <div class="form-page container">
      <Show when={form()} fallback={<div>Loading...</div>}>
        {(f) => (
          <>
            <Title>{f().title} - Surge Media</Title>
            <h1>{f().title}</h1>
            <Show when={f().description}><p>{f().description}</p></Show>
            <Show when={submitted()} fallback={
              <form onSubmit={handleSubmit}>
                <For each={f().questions}>
                  {(q: FormQuestion) => (
                    <div class="form-field">
                      <label>{q.question}{q.isRequired && ' *'}</label>
                      {q.type === 'text' && <input type="text" required={q.isRequired} onInput={(e) => updateAnswer(q.id, e.currentTarget.value)} />}
                      {q.type === 'textarea' && <textarea required={q.isRequired} onInput={(e) => updateAnswer(q.id, e.currentTarget.value)} />}
                      {q.type === 'radio' && q.options?.map(opt => (
                        <label><input type="radio" name={q.id} value={opt} onChange={() => updateAnswer(q.id, opt)} /> {opt}</label>
                      ))}
                    </div>
                  )}
                </For>
                <button type="submit">Submit</button>
              </form>
            }>
              <div class="success">{f().successMessage || 'Thank you for your submission!'}</div>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
};

export default FormPage;
