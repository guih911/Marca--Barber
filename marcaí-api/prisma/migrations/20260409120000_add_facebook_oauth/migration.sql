ALTER TABLE "usuarios"
ADD COLUMN "facebookId" TEXT;

CREATE UNIQUE INDEX "usuarios_facebookId_key"
ON "usuarios"("facebookId");
