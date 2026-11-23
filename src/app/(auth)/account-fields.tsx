export function AccountFields() {
  return (
    <>
      <div>
        <label className="label" htmlFor="name">Prénom</label>
        <input id="name" name="name" className="field" autoComplete="given-name" required maxLength={60} />
      </div>
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" className="field" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" className="field" autoComplete="new-password" minLength={8} required />
        <p className="hint">8 caractères minimum</p>
      </div>
    </>
  );
}
