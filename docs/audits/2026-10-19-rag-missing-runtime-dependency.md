# 503 de documentos después de registrar las rutas

El entorno administrado de Electron no tenía instalado `sqlite_vec`. El registro del backend indicaba `No module named 'sqlite_vec'`. El archivo `requirements/studio.txt` había excluido RAG, aunque la interfaz seguía consultando documentos y las rutas se habían vuelto a registrar.

Se instaló `sqlite-vec==0.1.9` en el entorno administrado y se agregó esa misma versión a los requisitos. Es la versión ya presente en el entorno de pruebas del proyecto. Una comprobación en un proceso nuevo, con una base de datos temporal, devuelve `RAG available: True`; no se modificó la base de datos de documentos del usuario para esta comprobación.

El selector de menciones de archivos ahora observa la disponibilidad de RAG y deja de solicitar listas de documentos mientras el backend lo marque como no disponible. No se convierte un fallo de almacenamiento en una lista vacía global ni se cambia el estado a disponible sin confirmación.

El proceso ya iniciado había fijado el resultado fallido de importación en memoria. Es necesario reiniciar el backend de Spartan para cargar la dependencia instalada. Esto no acredita por sí solo la ingestión y búsqueda completas ni resuelve cualquier posible fallo independiente del primer envío al modelo.
