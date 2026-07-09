def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    """Trocea un texto en fragmentos solapados, respetando palabras.

    Args:
        text: Texto a trocear.
        chunk_size: Número máximo de palabras por chunk.
        overlap: Número de palabras de solapamiento entre chunks.

    Returns:
        Lista de chunks de texto.
    """
    if not text:
        return []
    words = text.split()
    if len(words) <= chunk_size:
        return [text]

    chunks: list[str] = []
    step = max(1, chunk_size - overlap)
    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk:
            chunks.append(chunk)
        if i + chunk_size >= len(words):
            break
    return chunks
