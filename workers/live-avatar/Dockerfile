FROM python:3.12-slim

RUN useradd --create-home --uid 10001 nuncio

ENV HOME=/home/nuncio \
    XDG_CACHE_HOME=/home/nuncio/.cache

WORKDIR /app

COPY requirements.lock .
RUN pip install --no-cache-dir --require-hashes -r requirements.lock

COPY --chown=nuncio:nuncio agent.py pyproject.toml uv.lock ./

USER nuncio

RUN python agent.py download-files

CMD ["python", "agent.py", "start"]
