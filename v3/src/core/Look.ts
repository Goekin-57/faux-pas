// Prototype de direction graphique « v2 » (maquettes) : activé par ?look=v2 dans l'adresse.
// Rien ne change pour le jeu publié tant que ce drapeau n'est pas passé par défaut.
export const LOOK2 = (() => {
  try {
    return new URLSearchParams(window.location.search).get('look') === 'v2';
  } catch {
    return false;
  }
})();
