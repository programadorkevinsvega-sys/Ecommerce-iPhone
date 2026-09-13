"use client";

import { useState } from "react";
import { assertLength, normalizeIdentifier, normalizeMultiline, safeFormError, validateRating } from "../lib/inputValidation";

type Review = { id:string; rating:number; title?:string; body:string; customerName:string; verifiedPurchase:boolean; adminResponse?:string };

export function ProductReviews({ productId, initialReviews }:{ productId:string; initialReviews:readonly Review[] }) {
  const [reviews,setReviews] = useState([...initialReviews]);
  const [open,setOpen] = useState(false);
  const [orderId,setOrderId] = useState("");
  const [rating,setRating] = useState("5");
  const [body,setBody] = useState("");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const average=reviews.length?reviews.reduce((s,r)=>s+r.rating,0)/reviews.length:0;

  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const normalizedOrderId = assertLength(normalizeIdentifier(orderId), "orderId");
      const normalizedBody = assertLength(normalizeMultiline(body), "reviewBody");
      const normalizedRating = validateRating(rating);
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({ orderId:normalizedOrderId, rating:normalizedRating, body:normalizedBody }),
      });
      if (!response.ok) {
        setMessage(safeFormError(response.status, "No fue posible enviar la reseña."));
        return;
      }
      setMessage("Reseña enviada. Quedará pendiente de moderación.");
      setBody("");
      setOpen(false);
    } catch {
      setMessage("Revisa los datos de la reseña e inténtalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="reviews-section" aria-labelledby="reviews-title">
    <div className="reviews-heading"><div><p className="eyebrow">Opiniones</p><h2 id="reviews-title">Lo que dicen nuestros clientes.</h2></div><div className="review-summary" aria-label={reviews.length?`${average.toFixed(1)} de 5 estrellas, ${reviews.length} opiniones`:"Sin opiniones todavía"}><strong>{reviews.length?average.toFixed(1):"—"}</strong><span>{reviews.length?`/ 5 · ${reviews.length} ${reviews.length===1?"opinión":"opiniones"}`:"Sé el primero en opinar"}</span></div></div>
    {reviews.length===0?<p className="review-empty">Todavía no hay opiniones aprobadas para este producto.</p>:<div className="review-list">{reviews.map(r=><article className="review-card" key={r.id}><div className="review-card-top"><strong aria-label={`${r.rating} de 5 estrellas`}>{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</strong>{r.verifiedPurchase&&<span>Compra verificada</span>}</div>{r.title&&<h3>{r.title}</h3>}<p>{r.body}</p><small>{r.customerName}</small>{r.adminResponse&&<blockquote><strong>Respuesta de la tienda:</strong> {r.adminResponse}</blockquote>}</article>)}</div>}
    <div className="review-actions"><button className="button secondary" type="button" onClick={()=>setOpen(!open)} aria-expanded={open}>{open?"Cerrar":"Escribir una reseña"}</button>{message&&<p role="status" aria-live="polite">{message}</p>}</div>
    {open&&<form className="review-form" onSubmit={submit} aria-describedby={message?"review-message":undefined}>
      <h3>Comparte tu experiencia</h3>
      <label htmlFor="review-order-id">Pedido entregado</label><input id="review-order-id" name="orderId" value={orderId} onChange={e=>setOrderId(e.target.value)} placeholder="ID de tu pedido" autoComplete="off" minLength={1} maxLength={128} required aria-describedby="review-order-help" /><small id="review-order-help">Usa el identificador del pedido asociado a esta compra.</small>
      <label htmlFor="review-rating">Calificación</label><select id="review-rating" name="rating" value={rating} onChange={e=>setRating(e.target.value)} autoComplete="off" required aria-label="Calificación de 1 a 5 estrellas"><option value="5">5 — Excelente</option><option value="4">4 — Muy buena</option><option value="3">3 — Buena</option><option value="2">2 — Regular</option><option value="1">1 — Mala</option></select>
      <label htmlFor="review-body">Comentario</label><textarea id="review-body" name="body" value={body} onChange={e=>setBody(e.target.value)} minLength={10} maxLength={3000} rows={5} required autoComplete="off" aria-describedby="review-body-help" /><small id="review-body-help">Entre 10 y 3000 caracteres.</small>
      {message&&<p id="review-message" role="alert">{message}</p>}
      <button className="button primary" type="submit" disabled={busy}>{busy?"Enviando…":"Enviar reseña"}</button>
    </form>}
  </section>;
}
