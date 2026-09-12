# Public ML deployment

Status: deployment files prepared; the Python service has not yet been hosted.
The existing Vercel website and PostgreSQL database are already deployed.

## Prepared container

Build context: `ml-service`. The Docker image installs CPU PyTorch and downloads
all three pinned public models at build time. No local model files, incident data
or environment secrets enter the build context. The service runs as user 1000,
requires `ML_SERVICE_KEY`, and listens on `PORT` (default 8000), with one worker.
Restarts load the models from the image without another model download.

Docker is not installed on the development machine, so the container build must
be verified by the hosting provider. The Python entry point is checked locally.

## Hugging Face Spaces

1. Create a Docker Space with CPU Basic hardware under the owner's account.
2. Upload tracked files from `ml-service` except tests, datasets, models and deploy.
   Replace the root README with `ml-service/deploy/SPACE_README.md`.
3. Generate a private random service key and store it as the Space secret
   `ML_SERVICE_KEY`. Never commit or expose it in a frontend variable.
4. Wait for the build and startup, then check `/health` with the private key.
   Image, text and similarity must all report `ready`.
5. Set Vercel production `ML_SERVICE_URL` to the actual HTTPS Space endpoint and
   `ML_SERVICE_KEY` to the matching secret. Set `ML_TIMEOUT_MS=15000` initially.
6. Redeploy the existing Vercel project and verify `/api/ml/status` and a synthetic
   `/api/ai/preview` request. A preview does not create an incident.

As checked on 2026-09-12, creating Docker Spaces requires a paid account plan.
The signed-in account's Docker option is disabled until upgraded. CPU Basic has
no hourly hardware charge but can sleep when idle, causing a cold start. This
is suitable for a project demonstration; continuous emergency service operation
requires an appropriately provisioned always-on deployment.

Sources: https://huggingface.co/docs/hub/spaces-overview and
https://huggingface.co/pricing.

## Other container providers

The same image can run on a container host with HTTPS and sufficient memory.
Local inference used about 2.3 GiB working memory; allow additional capacity for
peak requests and verify on the target machine. Configure the assigned `PORT`,
shared key and health check. `/health` requires authentication, so use a TCP
health check if the provider cannot attach a header.

For optional trained mode, build with `DOWNLOAD_PRETRAINED=0`, mount trusted
artifacts under `MODEL_DIR`, and set `ML_MODEL_MODE=trained`.
