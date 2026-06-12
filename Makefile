VERCEL ?= vercel

.PHONY: deploy

deploy:
	npm test
	$(VERCEL) --prod
