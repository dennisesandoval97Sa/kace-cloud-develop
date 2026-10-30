import { apiService } from "@kace/utils"
import { GROUP_SERVICE } from "../../../utils/URL"

export const filterRelationships  = (id) => {
  return {
    filter: [
        {
            field: "classification_id",
            operator: "eq",
            value: id,
            type: "AND",
        },
    ],
    limit: 10,
    offset: 0,
  }
}

export async function searchGroup(id= "null")  {
  let url = `${GROUP_SERVICE}/${id}`
  const data = await apiService.get(url)
  if (data?.data.data.nombre) {
    return data.data.data.nombre
  }
  return null
}