# Registro de instrucciones

Las notas de clase contienen los prompts originales: https://mini-octopus-f21.notion.site/Taller-Programar-con-Cursor-para-ejecutivos-407a09f53c9c81d89519fd4176131fea

## Instrucciones dadas en esta sesión

1. Explorar los módulos y resumir lo necesario hasta el taller 2.
2. Desarrollar el taller usando las notas de clase, MongoDB, Gemini en lugar de OpenAI, repositorio en NovaDevSas y despliegue posterior del estudiante en Cloudflare Pages.

## Decisiones de implementación

- Se adaptó el demo de Node/Express a Pages Functions y el proveedor Anthropic/OpenAI a Gemini.
- Se incorporó persistencia por sesión en MongoDB, endpoints para proteger y restaurar, y un flujo completo con el modelo.
- Se eligieron datos ficticios y una clave de acceso compartida para el demo. La detección de datos es deliberadamente limitada; no garantiza anonimización.

Este documento registra las instrucciones y decisiones de esta sesión; no representa prompts ejecutados en Cursor ni sustituye las capturas y resultados reales solicitados por el curso.
