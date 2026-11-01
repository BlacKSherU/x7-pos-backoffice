import { useState, type FormEvent } from 'react';

interface ContactSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactSalesModal({ isOpen, onClose }: ContactSalesModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  function handleClose() {
    setSubmitted(false);
    setName('');
    setEmail('');
    setMessage('');
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-sales-title"
    >
      <div className="surface-paper login-shadow rounded-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-h2 text-text font-semibold"
            id="contact-sales-title"
          >
            Contact Sales
          </h2>
          <button
            aria-label="Close"
            className="text-text/60 hover:text-text"
            onClick={handleClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-primary text-4xl mb-3">
              check_circle
            </span>
            <p className="text-body-md text-text">
              Thank you! Our enterprise team will contact you shortly.
            </p>
            <button
              className="mt-6 px-6 py-2 bg-primary text-white rounded-lg font-semibold"
              onClick={handleClose}
              type="button"
            >
              Close
            </button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <p className="text-body-sm text-text/60">
              Tell us about your enterprise needs and we will reach out with a
              custom plan.
            </p>
            <div>
              <label className="text-label-caps text-stone-500 block mb-1">
                Name
              </label>
              <input
                className="w-full px-4 py-3 border border-border rounded-lg text-body-md"
                onChange={(e) => setName(e.target.value)}
                required
                type="text"
                value={name}
              />
            </div>
            <div>
              <label className="text-label-caps text-stone-500 block mb-1">
                Email
              </label>
              <input
                className="w-full px-4 py-3 border border-border rounded-lg text-body-md"
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <div>
              <label className="text-label-caps text-stone-500 block mb-1">
                Message
              </label>
              <textarea
                className="w-full px-4 py-3 border border-border rounded-lg text-body-md resize-none"
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                value={message}
              />
            </div>
            <button
              className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
              type="submit"
            >
              Submit Inquiry
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
