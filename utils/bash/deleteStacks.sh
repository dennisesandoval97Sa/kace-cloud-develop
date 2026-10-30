#!/bin/bash

MAX_PARALLEL=3
CURRENT_JOBS=0

echo "Ingrese el prefijo de los STACKS a eliminar:"
read STACK_PREFIX
if [[ -z "$STACK_PREFIX" ]]; then
  echo "❌ El prefijo no puede estar vacío."
  exit 1
fi

# Mostrar los stacks que se van a eliminar con sus estados
echo "🔍 Stacks encontrados:"
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE DELETE_FAILED \
  --query "StackSummaries[?starts_with(StackName, '$STACK_PREFIX')].[StackName,StackStatus]" \
  --output table

echo "⚠️ Se van a eliminar todos los stacks que empiecen por '$STACK_PREFIX'. ¿Desea continuar? (y/n)"
read confirmacion
if [[ $confirmacion != "y" ]]; then
  echo "🚫 Operación cancelada."
  exit 0
fi

# Función para eliminar un stack y esperar a que se elimine
delete_stack() {
  local stack_name="$1"
  local stack_status="$2"

  echo "🚧 Eliminando stack: $stack_name (Estado: $stack_status)"

  if [[ "$stack_status" == "DELETE_FAILED" ]]; then
    echo "  ⚠️ Stack en DELETE_FAILED, usando FORCE_DELETE_STACK"
    aws cloudformation delete-stack --stack-name "$stack_name" --deletion-mode FORCE_DELETE_STACK
  else
    aws cloudformation delete-stack --stack-name "$stack_name"
  fi

  if [ $? -eq 0 ]; then
    echo "  ⏳ Esperando eliminación completa de $stack_name..."
    aws cloudformation wait stack-delete-complete --stack-name "$stack_name"
    if [ $? -eq 0 ]; then
      echo "  ✅ Stack $stack_name eliminado exitosamente."
    else
      echo "  ❌ Error al esperar eliminación de $stack_name."
    fi
  else
    echo "  ❌ Error al lanzar eliminación de $stack_name."
  fi
}

# Leer lista de stacks y lanzar eliminaciones en paralelo con máximo 3 a la vez
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE DELETE_FAILED \
  --query "StackSummaries[?starts_with(StackName, '$STACK_PREFIX')].[StackName,StackStatus]" \
  --output text | while read stack_name stack_status; do

    # Lanzar en subshell para correr en background
    (
      delete_stack "$stack_name" "$stack_status"
    ) &

    ((CURRENT_JOBS++))

    # Si alcanzamos el límite de procesos paralelos, esperar a que uno termine
    if [[ $CURRENT_JOBS -ge $MAX_PARALLEL ]]; then
      wait -n
      ((CURRENT_JOBS--))
    fi
done

# Esperar que todos los procesos restantes terminen
wait

echo "🎉 Todos los stacks que comienzan con '$STACK_PREFIX' han sido procesados."
