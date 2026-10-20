# Geoestudi

Aplicació web d'estudi en català per preparar la unitat **UP1: Geografia física — relleu, aigua i clima**.

Inclou fitxes de memòria activa, preguntes tipus test, repàs de parelles, llista per preparar l'atles i seguiment local del progrés. No necessita compilació ni dependències.

## Sales multijugador

La web permet crear sales temporals amb un codi de sis caràcters. Cada jugador obre la web al seu dispositiu i introdueix el codi. Les partides tenen vuit rondes variades: omple els buits, tria una resposta, cert o fals i paraula llampec. El creador de la sala inicia les rondes i coordina la puntuació; les connexions entre jugadors fan servir PeerJS/WebRTC. Cal connexió a internet i carregar la biblioteca PeerJS des de CDN. Les sales no són persistents i es tanquen quan el creador surt.

## Publicar amb GitHub Pages

A **Settings → Pages**, tria **Deploy from a branch**, selecciona `main` i la carpeta `/ (root)`. GitHub Pages publicarà el lloc a `https://acastejongames.github.io/geoestudi/` quan el desplegament acabi.

