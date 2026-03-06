"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Client } from "@/lib/data";
import { Mail, Phone, Building2 } from "lucide-react";

interface ClientTableProps {
    clients: Client[];
}

export function ClientTable({ clients }: ClientTableProps) {
    const getStatusColor = (status: string) => {
        return status === "active"
            ? "bg-green-500/20 text-green-500"
            : "bg-gray-500/20 text-gray-500";
    };

    return (
        <div className="rounded-lg border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead>Projects</TableHead>
                        <TableHead>Total Spent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {clients.map((client) => (
                        <TableRow key={client.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={client.avatar} alt={client.name} />
                                        <AvatarFallback>
                                            {client.name
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <Link
                                            href={`/clients/${client.id}`}
                                            className="font-medium text-foreground hover:underline"
                                        >
                                            {client.name}
                                        </Link>
                                        <p className="text-sm text-muted-foreground">{client.email}</p>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span>{client.company}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline">{client.industry}</Badge>
                            </TableCell>
                            <TableCell>
                                <span className="font-medium">{client.projectsCount}</span>
                                <span className="text-muted-foreground"> projects</span>
                            </TableCell>
                            <TableCell>
                                <span className="font-medium">${client.totalSpent.toLocaleString()}</span>
                            </TableCell>
                            <TableCell>
                                <Badge className={getStatusColor(client.status)}>
                                    {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Button variant="ghost" size="sm" asChild>
                                        <a href={`mailto:${client.email}`}>
                                            <Mail className="h-4 w-4" />
                                        </a>
                                    </Button>
                                    <Button variant="ghost" size="sm" asChild>
                                        <a href={`tel:${client.phone}`}>
                                            <Phone className="h-4 w-4" />
                                        </a>
                                    </Button>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/clients/${client.id}`}>View</Link>
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
