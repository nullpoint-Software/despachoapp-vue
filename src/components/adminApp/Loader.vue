<template>
    <div class="fixed inset-0 bg-transparent backdrop-blur-md flex items-center justify-center z-50">
      <div class="loader">
        <!-- SVG filter para unión tipo 'goo' más suave -->
        <svg xmlns="http://www.w3.org/2000/svg" class="hidden">
          <filter id="goo">
            <!-- Menor blur para bordes más nítidos -->
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
            <!-- Ajuste de matriz para unión más realista -->
            <feColorMatrix in="blur" mode="matrix"
              values="1 0 0 0 0  
                      0 1 0 0 0  
                      0 0 1 0 0  
                      0 0 0 14 -6"
              result="goo"/>
            <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
          </filter>
        </svg>
        <!-- Dos bloques con bordes redondeados -->
        <div class="dot dot1"></div>
        <div class="dot dot2"></div>
      </div>
    </div>
  </template>
  
  <script setup>
  // Loader puro CSS, sin JS adicional
  </script>
  
  <style scoped>
  /* Contenedor aplica filtro goo */
  .loader {
    width: 100px;
    aspect-ratio: 1;
    position: relative;
    filter: url(#goo);
  }
  
  /* Bloques cuadrados con esquinas redondeadas */
  .dot {
    width: 40px;
    height: 40px;
    background: #ffff00;      /* color único */
    border-radius: 8px;       /* esquinas suaves */
    position: absolute;
    animation: move 2s infinite ease-in-out;
  }
  
  /* Segundo bloque con desfase */
  .dot2 {
    animation-delay: -1s;
  }
  
  /* Recorrido cuadrado */
  @keyframes move {
    0%   { transform: translate(   0%,   0%); }
    25%  { transform: translate(100%,   0%); }
    50%  { transform: translate(100%, 100%); }
    75%  { transform: translate(   0%, 100%); }
    100% { transform: translate(   0%,   0%); }
  }
  </style>
  