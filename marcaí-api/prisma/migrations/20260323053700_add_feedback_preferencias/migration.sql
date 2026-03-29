-- AlterTable
ALTER TABLE "agendamentos" ADD COLUMN     "feedbackComentario" TEXT,
ADD COLUMN     "feedbackNota" INTEGER;

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "preferencias" TEXT;
