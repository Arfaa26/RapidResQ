# Public ML deployment

Status: a free Space `arfaa0312/rapidresq-ml` has been created; application upload
and Vercel connection are being validated. GitHub Actions publishes through a
trusted publisher restricted to this repository, `web-app`, and `deploy-ml.yml`.
The existing Vercel website and PostgreSQL database are already deployed.

## Selected free plan: Gradio ZeroGPU

The user selected free hosting. Use the existing free Space rather than buying
Docker hosting. Package tracked service code with
`python ml-service/deploy/package_space.py --output <destination.zip>` and upload
its contents to the Space repository. Its README selects `space_app.py`, Gradio
6.27.0 and Python 3.12. Set the private `ML_SERVICE_KEY` Space secret before boot.

The entry point downloads the pinned models, loads them on ZeroGPU's virtual CUDA
device, and executes image/text/semantic inference through `spaces.GPU`. It retains
the existing classification and review policies. Requests and results use Gradio's
standard queue API. Health/evaluation/hotspots do not allocate GPU time.

After the Space is running, set Vercel production:
- `ML_SERVICE_URL`: the verified HTTPS Space endpoint
- `ML_SERVICE_TRANSPORT=gradio`
- `ML_SERVICE_KEY`: the same private Space secret
- `ML_TIMEOUT_MS=45000`

Redeploy and verify all three models ready plus a synthetic photo/text preview.
No real incident should be created for validation. Requests use a bounded queue
and timeout. Free GPU quotas, sleeping or provider errors retain manual review.
This is a free project demo, not an always-on emergency dispatch service.

The free plan supports up to two ZeroGPU Spaces for eligible accounts. CPU Basic
Docker is not the selected plan. Do not purchase a subscription or bypass the
provider's quotas. See https://huggingface.co/docs/hub/spaces-zerogpu.

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
