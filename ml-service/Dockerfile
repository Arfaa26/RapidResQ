FROM python:3.13-slim
RUN useradd --create-home --uid 1000 appuser
WORKDIR /home/appuser/app
COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.10.0 torchvision==0.25.0 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt
USER appuser
COPY --chown=appuser:appuser pretrained ./pretrained
# Include pinned public weights in the image so restarts do not download them.
ARG DOWNLOAD_PRETRAINED=1
RUN if [ "$DOWNLOAD_PRETRAINED" = "1" ]; then python -m pretrained.download; fi
COPY --chown=appuser:appuser . .
ENV TORCH_NUM_THREADS=2
ENV ML_MODEL_MODE=pretrained
ENV ML_REQUIRE_KEY=1
EXPOSE 8000
CMD ["python", "serve.py"]
